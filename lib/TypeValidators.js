
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

var TYPE_VALIDATORS = {
    object:     function (value, callback) {
        var keys = Object.keys (value);
        var len = keys.length;
        var remaining = {};
        for (var key in this.children)
            remaining[key] = true;

        // minKeys
        if (this.constraints.min !== undefined && len < this.constraints.min)
            throw {
                error:      'limit',
                msg:        'too few keys on Object',
                constraint: this.constraints.min,
                value:      value
            };

        // maxKeys
        if (this.constraints.max !== undefined && len > this.constraints.max)
            throw {
                error:      'limit',
                msg:        'too many keys on Object',
                constraint: this.constraints.max,
                value:      value
            };

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
                    return process.nextTick (function(){ callback ({
                        error:  'illegal',
                        msg:    'found extra key',
                        key:    name
                    }); });
                }
            }, function (err) {
                if (err)
                    return process.nextTick (function(){ callback (err); });
                if (exists.length) // unresolved .exists
                    return process.nextTick (function(){ callback ({
                        error:  'missing',
                        msg:    'could not resolve a .exists constraint'
                    }); });

                var leftovers = Object.keys (remaining);
                if (!leftovers.length)
                    return process.nextTick (callback);

                // we can do this test synchronously
                for (var i in leftovers)
                    if (!self.children[leftovers[i]].constraints.optional)
                        return process.nextTick (function(){ callback ({
                            error:  'missing',
                            msg:    'Object incomplete',
                            value:  value
                        }); });
                process.nextTick (callback);
            });
        }

        // children - sync
        for (var name in value) {
            delete remaining[name];
            if (Object.hasOwnProperty.call (this.children, name))
                this.children[name].validate (value[name])
            else
                // unknown key
                if (this.constraints.keyTest) {
                    return this.constraints.keyTest.validate (name, postValidate)
                } else if (!this.constraints.adHoc)
                    throw {
                        error:  'illegal',
                        msg:    'found unknown key',
                        key:    name
                    };

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
            if (this.constraints.all)
                this.constraints.all.validate (value[name]);
        }
        // unresolved .exists
        if (exists.length)
            throw {
                error:  'missing',
                msg:    'could not resolve all .exists constraints',
                value:  value
            };
        // missing keys?
        var leftovers = Object.keys (remaining);
        if (!leftovers.length)
            return;
        for (var i in leftovers)
            if (!this.children[leftovers[i]].constraints.optional)
                throw {
                    error:  'missing',
                    msg:    'Object incomplete',
                    value:  value
                };
    },
    array:      function (value, callback) {
        var self = this;
        var len = value.length;

        // minVals
        if (this.constraints.min !== undefined && len < this.constraints.min)
            throw {
                error:      'limit',
                msg:        'Array length below minimum',
                constraint: this.constraints.min,
                value:      value
            };

        // maxVals
        if (this.constraints.max !== undefined && len > this.constraints.max)
            throw {
                error:      'limit',
                msg:        'Array length above maximum',
                constraint: this.constraints.min,
                value:      value
            };

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
                    return process.nextTick (function(){ callback ({
                        error:  'missing',
                        msg:    'could not resolve all .exists constraints',
                        value:  value
                    }); });
                process.nextTick (callback);
            });

        // sync
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
            if (this.constraints.all)
                this.constraints.all.validate (value[i]);
        }

        // unresolved .exists
        if (exists.length)
            throw {
                error:  'missing',
                msg:    'could not resolve all .exists constraints',
                value:  value
            };
    },
    string:     function (value, callback) {
        var len = value.length;

        // min
        if (this.constraints.min !== undefined && len < this.constraints.min)
            throw {
                error:      'limit',
                msg:        'String length below minimum',
                constraint: this.constraints.min,
                value:      value
            };

        // max
        if (this.constraints.max !== undefined && len > this.constraints.max)
            throw {
                error:      'limit',
                msg:        'String length above maximum',
                constraint: this.constraints.max,
                value:      value
            };

        // regex matching
        if (this.constraints.match !== undefined && !this.constraints.match.test (value))
            throw {
                error:      'format',
                msg:        'String did not match expression',
                constraint: this.constraints.match,
                value:      value
            };

        if (callback) process.nextTick (callback);
    },
    number:     function (value, callback) {
        // min
        if (this.constraints.min !== undefined && value < this.constraints.min)
            throw {
                error:      'limit',
                msg:        'Number value below minimum',
                constraint: this.constraints.min,
                value:      value
            };

        // exclusiveMin
        if (this.constraints.exclusiveMin !== undefined && value <= this.constraints.exclusiveMin)
            throw {
                error:      'limit',
                msg:        'Number value below or equal to minimum limit',
                constraint: this.constraints.min,
                value:      value
            };

        // max
        if (this.constraints.max !== undefined && value > this.constraints.max)
            throw {
                error:      'limit',
                msg:        'Number value above maximum',
                constraint: this.constraints.min,
                value:      value
            };

        // exclusiveMax
        if (this.constraints.exclusiveMax !== undefined && value >= this.constraints.exclusiveMax)
            throw {
                error:      'limit',
                msg:        'Number value above or equal to maximum limit',
                constraint: this.constraints.min,
                value:      value
            };

        // modulo
        if (this.constraints.modulo !== undefined) {
            var divisor = this.constraints.modulo[0];
            var remainder = this.constraints.modulo[1];
            if (value % divisor == remainder)
                if (callback) return process.nextTick (callback);
                else return;

            throw {
                error:      'format',
                msg:        'Number does not meet modulo constraint',
                constraint: this.constraints.modulo,
                value:      value
            };
        }

        if (callback) process.nextTick (callback);
    },
    boolean:    function (value, callback) {
        if (callback) process.nextTick (callback);
    }
};

module.exports = TYPE_VALIDATORS;
