
var async = require ('async');

var typeGetter = ({}).toString;
try { Buffer; } catch (err) { Buffer = function(){}; }
function getTypeStr (obj) {
    var tstr = typeGetter.apply(obj).slice(8,-1).toLowerCase();
    if (tstr == 'object')
        if (obj instanceof Buffer) return 'buffer';
        else return tstr;
    if (tstr == 'text') return 'textnode';
    if (tstr == 'comment') return 'commentnode';
    if (tstr.slice(0,4) == 'html') return 'element';
    return tstr;
}

var TYPE_REPORTERS = {
    object:     function (value, errors, callback) {
        var keys = Object.keys (value);
        var len = keys.length;
        var remaining = {};
        for (var key in this.children)
            remaining[key] = true;

        // minKeys
        if (this.constraints.min !== undefined && len < this.constraints.min)
            errors.push ({
                error:      'limit',
                msg:        'too few keys on Object',
                constraint: this.constraints.min,
                value:      value
            });

        // maxKeys
        if (this.constraints.max !== undefined && len > this.constraints.max)
            errors.push ({
                error:      'limit',
                msg:        'too many keys on Object',
                constraint: this.constraints.max,
                value:      value
            });

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
                    errors.push ({
                        error:  'illegal',
                        msg:    'found extra key',
                        key:    name
                    });
                    process.nextTick (callback);
                }
            }, function(){
                if (allFailed) // unresolved .all
                    errors.push ({
                        error:          'format',
                        msg:            '.all constraint failed',
                        constraint:     this.constraints.all
                    });
                for (var i in exists) // unresolved .exists
                    errors.push ({
                        error:          'missing',
                        msg:            'could not resolve a .exists constraint',
                        constraint:     exists[i]
                    });

                var leftovers = Object.keys (remaining);
                if (!leftovers.length)
                    return process.nextTick (callback);

                // we can do this test synchronously
                for (var i in leftovers)
                    if (!self.children[leftovers[i]].constraints.optional)
                        errors.push ({
                            error:  'missing',
                            msg:    'Object is missing a mandatory key',
                            key:    leftovers[i]
                        });
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
                    errors.push ({
                        error:  'illegal',
                        msg:    'found unknown key',
                        key:    name
                    });
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
                }
            }
        }
        // unresolved .all
        if (allFailed)
            errors.push ({
                error:          'format',
                msg:            '.all constraint failed',
                constraint:     this.constraints.all
            });
        // unresolved .exists
        for (var i in exists) // unresolved .exists
            errors.push ({
                error:          'missing',
                msg:            'could not resolve a .exists constraint',
                constraint:     exists[i]
            });
        // missing keys?
        var leftovers = Object.keys (remaining);
        if (!leftovers.length)
            return;
        for (var i in leftovers)
            if (!this.children[leftovers[i]].constraints.optional)
                errors.push ({
                    error:  'missing',
                    msg:    'Object is missing a mandatory key',
                    key:    leftovers[i]
                });
    },
    array:      function (value, errors, callback) {
        var self = this;
        var len = value.length;

        // minVals
        if (this.constraints.min !== undefined && len < this.constraints.min)
            errors.push ({
                error:      'limit',
                msg:        'Array length below minimum',
                constraint: this.constraints.min,
                value:      value
            });

        // maxVals
        if (this.constraints.max !== undefined && len > this.constraints.max)
            errors.push ({
                error:      'limit',
                msg:        'Array length above maximum',
                constraint: this.constraints.min,
                value:      value
            });

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
                        }
                        callback();
                    });
                });
            }, function (err) {
                if (err && err !== JUST_DONE)
                    return process.nextTick (function(){ callback (err); });
                if (allFailed) // unresolved .all
                    errors.push ({
                        error:          'format',
                        msg:            '.all constraint failed',
                        constraint:     self.constraints.all
                    });
                if (exists.length) // unresolved .exists
                    errors.push ({
                        error:  'missing',
                        msg:    'could not resolve all .exists constraints',
                        value:  value
                    });
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
                }
            }
        }

        // unresolved .all
        if (allFailed)
            errors.push ({
                error:          'format',
                msg:            '.all constraint failed',
                constraint:     this.constraints.all
            });
        // unresolved .exists
        for (var i in exists)
            errors.push ({
                error:      'missing',
                msg:        'could not resolve all .exists constraints',
                constraint: exists[i]
            });
    },
    string:     function (value, errors, callback) {
        var len = value.length;

        // min
        if (this.constraints.min !== undefined && len < this.constraints.min)
            errors.push ({
                error:      'limit',
                msg:        'String length below minimum',
                constraint: this.constraints.min,
                value:      value
            });

        // max
        if (this.constraints.max !== undefined && len > this.constraints.max)
            errors.push ({
                error:      'limit',
                msg:        'String length above maximum',
                constraint: this.constraints.max,
                value:      value
            });

        // regex matching
        if (this.constraints.match !== undefined && !this.constraints.match.test (value))
            errors.push ({
                error:      'format',
                msg:        'String did not match expression',
                constraint: this.constraints.match,
                value:      value
            });

        if (callback) process.nextTick (callback);
    },
    number:     function (value, errors, callback) {
        // min
        if (this.constraints.min !== undefined && value < this.constraints.min)
            errors.push ({
                error:      'limit',
                msg:        'Number value below minimum',
                constraint: this.constraints.min,
                value:      value
            });
        // exclusiveMin
        if (this.constraints.exclusiveMin !== undefined && value <= this.constraints.exclusiveMin)
            errors.push ({
                error:      'limit',
                msg:        'Number value below or equal to minimum limit',
                constraint: this.constraints.min,
                value:      value
            });

        // max
        if (this.constraints.max !== undefined && value > this.constraints.max)
            errors.push ({
                error:      'limit',
                msg:        'Number value above maximum',
                constraint: this.constraints.min,
                value:      value
            });
        // exclusiveMax
        if (this.constraints.exclusiveMax !== undefined && value >= this.constraints.exclusiveMax)
            errors.push ({
                error:      'limit',
                msg:        'Number value above or equal to maximum limit',
                constraint: this.constraints.min,
                value:      value
            });

        // modulo
        if (this.constraints.modulo !== undefined)
            if (value % this.constraints.modulo[0] != this.constraints.modulo[1])
                errors.push ({
                    error:      'format',
                    msg:        'Number does not meet modulo constraint',
                    constraint: this.constraints.modulo,
                    value:      value
                });

        if (callback) process.nextTick (callback);
    },
    boolean:    function (value, errors, callback) {
        if (callback) process.nextTick (callback);
    }
};

module.exports = TYPE_REPORTERS;
