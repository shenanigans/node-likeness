
var async = require ('async');
var getTypeStr = require ('./GetTypeStr');
var ValidationError = require ('./errors').ValidationError;

var TYPE_REPORTERS = {
    object:     function (value, errors, callback) {
        var keys = Object.keys (value);
        var len = keys.length;
        var remaining = {};
        for (var key in this.children)
            remaining[key] = true;

        // minKeys
        if (this.constraints.min !== undefined && len < this.constraints.min)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too few keys on Object'
            ));

        // maxKeys
        if (this.constraints.max !== undefined && len > this.constraints.max)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.max,
                value,
                this.path,
                'too many keys on Object'
            ));

        // clone .exists, so we can sweep it as we go
        var exists = [];
        var existsLives = [];
        for (var i in this.constraints.exists) {
            exists.push (this.constraints.exists[i]);
            existsLives.push (this.constraints.exists[i].constraints.times || 1);
        }

        // children - async
        if (callback) {
            if (!keys.length) return process.nextTick (callback);
            var self = this;
            var allFailed = false;
            return async.each (keys, function (name, callback) {
                delete remaining[name];

                // finalization function
                function postValidate(){
                    // manage .exists and .all commitments, pass the callback
                    if (exists.length) // process .exists constraints
                        return async.each (Object.keys (exists), function (i, callback) {
                            // we don't care about reports from .exists validations
                            exists[i].validate (value[name], function (err) {
                                if (!err && !--existsLives[i]) {
                                    delete exists[i];
                                    delete existsLives[i];
                                }
                                process.nextTick (callback);
                            });
                        }, function(){
                            // remove deleted .exists tests
                            exists = exists.filter (Boolean);
                            existsLives = existsLives.filter (Boolean);

                            if (!self.constraints.all)
                                return process.nextTick (callback);
                            var allErrors = [];
                            self.constraints.all.report (value[name], errors, function(){
                                if (!allErrors.length) return callback();
                                allFailed = true;
                                errors.push.apply (errors, allErrors);
                                errors.push (new ValidationError (
                                    'FORMAT',
                                    self.constraints.all,
                                    value[name],
                                    self.path,
                                    '.all constraint failed',
                                    allErrors
                                ));
                            });
                        });

                    // no .exists constraints
                    if (!self.constraints.all)
                        return process.nextTick (callback);
                    self.constraints.all.report (value[name], errors, callback);
                }

                if (Object.hasOwnProperty.call (self.children, name))
                    return self.children[name].report (value[name], errors, postValidate);
                else {
                    // unknown key
                    if (self.constraints.keyTest) {
                        var keyErrors = [];
                        return self.constraints.keyTest.report (name, keyErrors, function(){
                            if (!keyErrors.length)
                                return postValidate();
                            errors.push.apply (errors, keyErrors);
                            process.nextTick (callback);
                        });
                    }
                    if (self.constraints.adHoc)
                        return postValidate();
                    errors.push (new ValidationError (
                        'ILLEGAL',
                        undefined,
                        name,
                        self.path,
                        'found unknown extra key'
                    ));
                    process.nextTick (callback);
                }
            }, function(){
                for (var i in exists) // unresolved .exists
                    errors.push (new ValidationError (
                        'MISSING',
                        exists[i],
                        value,
                        self.path,
                        'could not resolve a .exists constraint'
                    ));

                var leftovers = Object.keys (remaining);
                if (!leftovers.length)
                    return process.nextTick (callback);

                // we can do this test synchronously
                for (var i in leftovers)
                    if (!self.children[leftovers[i]].constraints.optional)
                        errors.push (new ValidationError (
                            'MISSING',
                            undefined,
                            value,
                            self.path,
                            'Object incomplete'
                        ));
                process.nextTick (callback);
            });
        }

        // children - sync
        var allFailed = false;
        for (var name in value) {
            delete remaining[name];
            if (Object.hasOwnProperty.call (this.children, name))
                this.children[name].report (value[name], errors)
            else
                // unknown key
                if (this.constraints.keyTest) {
                    if (!this.constraints.keyTest.report (name, errors))
                        continue;
                } else if (!this.constraints.adHoc) {
                    errors.push (new ValidationError (
                        'ILLEGAL',
                        undefined,
                        name,
                        this.path,
                        'found unknown key'
                    ));
                    continue;
                }

            // .exists
            for (var i=0,j=exists.length; i<j; i++)
                try {
                    exists[i].validate (value[name])
                    if (!--existsLives[i]) {
                        exists.splice (i, 1);
                        existsLives.splice (i, 1);
                        i--; j--;
                    }
                } catch (err) { /* nobody cares */ }

            // .all
            if (this.constraints.all) {
                var allErrors = [];
                this.constraints.all.report (value[name], allErrors);
                if (allErrors.length) {
                    allFailed = true;
                    errors.push.apply (errors, allErrors);
                    errors.push (new ValidationError (
                        'FORMAT',
                        this.constraints.all,
                        value[name],
                        this.path,
                        '.all constraint failed',
                        allErrors
                    ));
                }
            }
        }
        // unresolved .exists
        for (var i in exists) // unresolved .exists
            errors.push (new ValidationError (
                'MISSING',
                exists[i],
                value,
                this.path,
                'could not resolve a .exists constraint'
            ));
        // missing keys?
        var leftovers = Object.keys (remaining);
        if (!leftovers.length)
            return;
        for (var i in leftovers)
            if (!this.children[leftovers[i]].constraints.optional)
                errors.push (new ValidationError (
                    'MISSING',
                    undefined,
                    value,
                    this.path,
                    'Object incomplete'
                ));
    },
    array:      function (value, errors, callback) {
        var self = this;
        var len = value.length;

        // minVals
        if (this.constraints.min !== undefined && len < this.constraints.min)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'Array length below minimum'
            ));

        // maxVals
        if (this.constraints.max !== undefined && len > this.constraints.max)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'Array length above maximum'
            ));

        if (!this.constraints.all && !this.constraints.exists) {
            if (callback) process.nextTick (callback);
            return;
        }

        // clone .exists, so we can sweep it as we go
        var exists = [];
        var existsLives = [];
        for (var i in this.constraints.exists) {
            exists.push (this.constraints.exists[i]);
            existsLives.push (this.constraints.exists[i].constraints.times || 1);
        }

        var JUST_DONE = {}; // a tag to throw
        var allFailed = false;
        if (callback)
            return async.each (value, function (element, callback) {
                if (!exists.length) {
                    var allErrors = [];
                    return self.constraints.all.report (element, allErrors, function(){
                        if (allErrors.length) {
                            allFailed = true;
                            errors.push.apply (errors, allErrors);
                        }
                        callback();
                    });
                }

                async.each (Object.keys (exists), function (i, callback) {
                    exists[i].validate (element, function (err) {
                        if (err) return process.nextTick (callback);
                        if (!--existsLives[i]) {
                            delete exists[i];
                            delete existsLives[i];
                        }
                        process.nextTick (callback);
                    });
                }, function(){
                    exists = exists.filter (Boolean);
                    existsLives = existsLives.filter (Boolean);
                    if (!exists.length && !self.constraints.all)
                        return process.nextTick (function(){ callback (JUST_DONE); });

                    if (!self.constraints.all)
                        return process.nextTick (callback);

                    var allErrors = [];
                    return self.constraints.all.report (element, allErrors, function(){
                        if (allErrors.length) {
                            allFailed = true;
                            errors.push.apply (errors, allErrors);
                            errors.push (new ValidationError (
                                'FORMAT',
                                self.constraints.all,
                                element,
                                self.path,
                                '.all constraint failed',
                                allErrors
                            ));
                        }
                        callback();
                    });
                });
            }, function (err) {
                if (err && err !== JUST_DONE)
                    return process.nextTick (function(){ callback (err); });
                for (var i in exists) // unresolved .exists
                    errors.push (new ValidationError (
                        'MISSING',
                        exists[i],
                        value,
                        self.path,
                        'could not resolve a .exists constraint'
                    ));
                process.nextTick (callback);
            });

        // sync
        var allFailed = false;
        if (!this.constraints.exists && !this.constraints.all) return;
        for (var i in value) {
            // .exists
            for (var k=0,l=exists.length; k<l; k++)
                try {
                    exists[k].validate (value[i])
                    if (!--existsLives[k]) {
                        exists.splice (k, 1);
                        existsLives.splice (k, 1);
                        k--; l--;
                    }
                } catch (err) { /* nobody cares */ }

            // .all
            if (this.constraints.all) {
                var allErrors = [];
                this.constraints.all.report (value[i], allErrors);
                if (allErrors.length) {
                    allFailed = true;
                    errors.push.apply (errors, allErrors);
                    errors.push (new ValidationError (
                        'FORMAT',
                        this.constraints.all,
                        value[i],
                        this.path,
                        '.all constraint failed',
                        allErrors
                    ));
                }
            }
        }

        // unresolved .exists
        for (var i in exists)
            errors.push (new ValidationError (
                'MISSING',
                exists[i],
                value,
                this.path,
                'could not resolve a .exists constraint'
            ));
    },
    string:     function (value, errors, callback) {
        var len = value.length;

        // min
        if (this.constraints.min !== undefined && len < this.constraints.min)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'String length below minimum'
            ));

        // max
        if (this.constraints.max !== undefined && len > this.constraints.max)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.max,
                value,
                this.path,
                'String length above maximum'
            ));

        // regex matching
        if (this.constraints.match !== undefined && !this.constraints.match.test (value))
            errors.push (new ValidationError (
                'FORMAT',
                this.constraints.match,
                value,
                'String did not match expression'
            ));

        if (callback) process.nextTick (callback);
    },
    number:     function (value, errors, callback) {
        // min
        if (this.constraints.min !== undefined && value < this.constraints.min)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                'Number value below minimum'
            ));
        // exclusiveMin
        if (this.constraints.exclusiveMin !== undefined && value <= this.constraints.exclusiveMin)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.exclusiveMin,
                value,
                'Number value below or equal to minimum limit'
            ));

        // max
        if (this.constraints.max !== undefined && value > this.constraints.max)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.max,
                value,
                'Number value above maximum'
            ));
        // exclusiveMax
        if (this.constraints.exclusiveMax !== undefined && value >= this.constraints.exclusiveMax)
            errors.push (new ValidationError (
                'LIMIT',
                this.constraints.exclusiveMax,
                value,
                'Number value above or equal to maximum limit'
            ));

        // modulo
        if (this.constraints.modulo !== undefined)
            if (value % this.constraints.modulo[0] != this.constraints.modulo[1])
                errors.push (new ValidationError (
                    'FORMAT',
                    this.constraints.modulo,
                    value,
                    'Number does not meet modulo constraint'
                ));

        if (callback) process.nextTick (callback);
    },
    boolean:    function (value, errors, callback) {
        if (callback) process.nextTick (callback);
    }
};

module.exports = TYPE_REPORTERS;
