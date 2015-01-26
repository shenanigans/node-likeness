
var async = require ('async');
var Set = require ('./Set');
var getTypeStr = require ('./GetTypeStr');
var ValidationError = require ('./errors').ValidationError;

var TYPE_VALIDATORS = {
    object:     function (value, callback) {
        var keys = Object.keys (value);
        var len = keys.length;
        var remaining = {};
        for (var key in this.children)
            remaining[key] = true;

        // minKeys
        if (this.constraints.min !== undefined && len < this.constraints.min)
            throw new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too few keys on Object'
            );

        // maxKeys
        if (this.constraints.max !== undefined && len > this.constraints.max)
            throw new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too many keys on Object'
            );

        // clone .exists, so we can sweep it as we go
        var exists = [];
        var existsLives = [];
        for (var i in this.constraints.exists) {
            exists.push (this.constraints.exists[i]);
            existsLives.push (this.constraints.exists[i].constraints.times || 1);
        }

        // children - async
        if (callback) {
            var self = this;
            var NOT_VALID = {}; // just a token to pass errors to the callback
            return async.each (keys, function (name, callback) {
                delete remaining[name];

                // finalization function
                function postValidate (err) {
                    // manage .exists and .all commitments, pass the callback
                    if (err) return process.nextTick (function(){ callback (err); });
                    if (exists.length) { // process .exists constraints
                        return async.each (Object.keys (exists), function (i, callback) {
                            exists[i].validate (value[name], function (err) {
                                if (err) return process.nextTick (callback);
                                if (!--existsLives[i]) {
                                    // we're guaranteed that `async` fired everything by now
                                    // so it's safe to edit these
                                    delete exists[i];
                                    delete existsLives[i];
                                }
                                process.nextTick (callback);
                            });
                        }, function (err) {
                            if (err) return process.nextTick (function(){ callback (err); });

                            // remove deleted .exists tests
                            exists = exists.filter (Boolean);
                            existsLives = existsLives.filter (Boolean);

                            if (!self.constraints.all)
                                return process.nextTick (callback);
                            self.constraints.all.validate (value[name], function (err) {
                                if (err) return process.nextTick (function(){ callback (err); });
                                return process.nextTick (callback);
                            });
                        });
                    }

                    // no .exists constraints
                    if (!self.constraints.all)
                        return process.nextTick (callback);
                    // test .all constraint
                    self.constraints.all.validate (value[name], function (err) {
                        if (err) return process.nextTick (function(){ callback (err); });
                        return process.nextTick (callback);
                    });
                }

                if (Object.hasOwnProperty.call (self.children, name))
                    return self.children[name].validate (value[name], postValidate);
                else {
                    // unknown key
                    if (self.constraints.keyTest)
                        return self.constraints.keyTest.validate (name, postValidate)
                    if (self.constraints.adHoc)
                        return process.nextTick (postValidate);
                    return process.nextTick (function(){ callback (new ValidationError (
                        'ILLEGAL',
                        undefined,
                        name,
                        self.path,
                        'found unknown extra key'
                    )); });
                }
            }, function (err) {
                if (err)
                    return process.nextTick (function(){ callback (err); });
                if (exists.length) // unresolved .exists
                    return process.nextTick (function(){ callback (new ValidationError (
                        'MISSING',
                        exists,
                        value,
                        self.path,
                        'could not resolve a .exists constraint'
                    )); });

                var leftovers = Object.keys (remaining);
                if (!leftovers.length)
                    return process.nextTick (callback);

                // we can do this test synchronously
                for (var i in leftovers)
                    if (!self.children[leftovers[i]].constraints.optional)
                        return process.nextTick (function(){ callback (new ValidationError (
                            'MISSING',
                            undefined,
                            value,
                            self.path,
                            'Object incomplete'
                        )); });
                process.nextTick (callback);
            });
        }

        // children - sync
        for (var name in value) {
            var childValue = value[name];
            delete remaining[name];
            if (Object.hasOwnProperty.call (this.children, name))
                this.children[name].validate (childValue)
            else
                // unknown key
                if (this.constraints.keyTest) {
                    return this.constraints.keyTest.validate (name, postValidate)
                } else {
                    if (this.constraints.matchChildren) {
                        var found = false;
                        for (var i=0,j=this.constraints.matchChildren.length; i<j; i++) {
                            var candidate = this.constraints.matchChildren[i];
                            if (candidate.pattern.test (name)) {
                                candidate.validate (childValue);
                                found = true;
                                break;
                            }
                        }
                        if (!found)
                            if (this.constraints.extras)
                                this.constraints.extras.validate (childValue);
                            else if (!this.constraints.adHoc)
                                throw new ValidationError (
                                    'ILLEGAL',
                                    undefined,
                                    name,
                                    this.path,
                                    'found unknown key'
                                );
                    } else if (this.constraints.extras)
                        this.constraints.extras.validate (childValue);
                    else if (!this.constraints.adHoc)
                        throw new ValidationError (
                            'ILLEGAL',
                            undefined,
                            name,
                            this.path,
                            'found unknown key'
                        );
                }

            // .exists
            for (var i=0,j=exists.length; i<j; i++)
                try {
                    exists[i].validate (childValue)
                    if (!--existsLives[i]) {
                        exists.splice (i, 1);
                        existsLives.splice (i, 1);
                        i--; j--;
                    }
                } catch (err) { /* nobody cares */ }

            // .all
            if (this.constraints.all)
                try {
                    this.constraints.all.validate (childValue);
                } catch (err) {
                    throw new ValidationError (
                        'FORMAT',
                        this.constraints.all,
                        value[name],
                        this.path,
                        '.all constraint failed',
                        err
                    );
                }
        }
        // unresolved .exists
        if (exists.length)
            throw new ValidationError (
                'MISSING',
                exists,
                value,
                this.path,
                'could not resolve a .exists constraint'
            );
        // missing keys?
        var leftovers = Object.keys (remaining);
        if (!leftovers.length)
            return;
        for (var i in leftovers)
            if (!this.children[leftovers[i]].constraints.optional)
                throw new ValidationError (
                    'MISSING',
                    undefined,
                    value,
                    this.path,
                    'Object incomplete'
                );
    },
    array:      function (value, callback) {
        var self = this;
        var len = value.length;
        // minVals
        if (this.constraints.min !== undefined && len < this.constraints.min)
            throw new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'Array length below minimum'
            );

        // maxVals
        if (this.constraints.max !== undefined && len > this.constraints.max)
            throw new ValidationError (
                'LIMIT',
                this.constraints.max,
                value,
                this.path,
                'Array length above maximum'
            );

        if (this.constraints.unique) {
            var set = new Set (value);
            if (set.count != value.length)
                throw new ValidationError (
                    'ILLEGAL',
                    true,
                    value,
                    this.path,
                    'duplicate value found among unique set'
                );
        }

        if (
            !this.constraints.exists
         && !this.constraints.all
         && !this.constraints.extras
         && !this.constraints.sequence
        ) {
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
        if (callback)
            return async.eachSeries (value, function (element, callback) {
                if (!exists.length)
                    return self.constraints.all.validate (element, callback);

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

                    self.constraints.all.validate (element, callback);
                });
            }, function (err) {
                if (err && err !== JUST_DONE)
                    return process.nextTick (function(){ callback (err); });
                if (exists.length)
                    return process.nextTick (function(){ callback (new ValidationError (
                        'MISSING',
                        exists,
                        value,
                        self.path,
                        'could not resolve a .exists constraint'
                    )); });
                process.nextTick (callback);
            });

        // sync
        for (var i=0,j=value.length; i<j; i++) {
            var childValue = value[i];

            // .exists
            for (var k=0,l=exists.length; k<l; k++)
                try {
                    exists[k].validate (childValue)
                    if (!--existsLives[k]) {
                        exists.splice (k, 1);
                        existsLives.splice (k, 1);
                        k--; l--;
                    }
                } catch (err) { /* nobody cares */ }

            // .all
            if (this.constraints.all)
                this.constraints.all.validate (childValue);

            // .sequence
            if (this.constraints.sequence)
                if (this.constraints.sequence[i])
                    this.constraints.sequence[i].validate (childValue);
                else if (this.constraints.extras)
                    this.constraints.extras.validate (childValue);
                else
                    throw new ValidationError (
                        'ILLEGAL',
                        undefined,
                        childValue,
                        self.path,
                        'found unexpected array item'
                    );

            // .extra
            if (this.constraints.extras && !this.constraints.all && !this.constraints.sequence)
                this.constraints.extras.validate (childValue);
        }

        // unresolved .exists
        if (exists.length)
            throw new ValidationError (
                'MISSING',
                exists,
                value,
                this.path,
                'could not resolve a .exists constraint'
            );
    },
    string:     function (value, callback) {
        var len = value.length;

        // min
        if (this.constraints.min !== undefined && len < this.constraints.min)
            throw new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'String length below minimum'
            );

        // max
        if (this.constraints.max !== undefined && len > this.constraints.max)
            throw new ValidationError (
                'LIMIT',
                this.constraints.max,
                value,
                this.path,
                'String length above maximum'
            );

        // exact length
        if (this.constraints.length !== undefined && len != this.constraints.length)
            throw new ValidationError (
                'LIMIT',
                this.constraints.length,
                value,
                this.path,
                'String is incorrect length'
            );

        // regex matching
        if (this.constraints.match !== undefined && !this.constraints.match.test (value))
            throw new ValidationError (
                'FORMAT',
                this.constraints.match,
                value,
                this.path,
                'String did not match expression'
            );

        if (callback) process.nextTick (callback);
    },
    number:     function (value, callback) {
        // min
        if (this.constraints.min !== undefined && value < this.constraints.min)
            throw new ValidationError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'Number value below minimum'
            );

        // exclusiveMin
        if (this.constraints.exclusiveMin !== undefined && value <= this.constraints.exclusiveMin)
            throw new ValidationError (
                'LIMIT',
                this.constraints.exclusiveMin,
                value,
                this.path,
                'Number value equal to or below minimum limit'
            );

        // max
        if (this.constraints.max !== undefined && value > this.constraints.max)
            throw new ValidationError (
                'LIMIT',
                this.constraints.max,
                value,
                this.path,
                'Number value above maximum'
            );

        // exclusiveMax
        if (this.constraints.exclusiveMax !== undefined && value >= this.constraints.exclusiveMax)
            throw new ValidationError (
                'LIMIT',
                this.constraints.exclusiveMax,
                value,
                this.path,
                'Number value equal to or above maximum limit'
            );

        // modulo
        if (this.constraints.modulo !== undefined) {
            var divisor = this.constraints.modulo[0];
            var remainder = this.constraints.modulo[1];
            if (value % divisor == remainder)
                if (callback) return process.nextTick (callback);
                else return;

            throw new ValidationError (
                'FORMAT',
                this.constraints.modulo,
                value,
                this.path,
                'Number does not meet modulo constraint'
            );
        }

        if (callback) process.nextTick (callback);
    },
    boolean:    function (value, callback) {
        if (callback) process.nextTick (callback);
    }
};

module.exports = TYPE_VALIDATORS;
