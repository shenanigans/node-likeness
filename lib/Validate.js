
/**     @member/Function likeness#validate
    Determine whether the provided document meets the configured constraints. Terminates validation
    at the first failure and returns a detailed [failure report](likeness.ValidationError). If a
    callback is provided, Errors are always passed to the callback - otherwise they are simply
    thrown.
@throws/likeness.ValidationError
    In synchronous mode, throws
@argument value
@callback
    @optional
    If present, the callback will always be honored. However, it is only necessary if this
    `likeness` has an asynchronous validation operation.
    @argument/Error|undefined err
    @argument/Boolean|undefined isValid
    @returns
@returns/likeness
    Self.
*/

var async = require ('async');
var getTypeStr = require ('./GetTypeStr');
var TYPE_VALIDATORS = require ('./TypeValidators');
var ValidationError = require ('./errors').ValidationError;
var matchLeaves = require ('./Sorting').matchLeaves;

function validate (value, callback) {
    var self = this;

    if (this.constraints.recurse)
        return this.constraints.recurse.validate (value, callback);

    if (value === undefined) {
        if (this.constraints.optional) {
            // optional value is missing, validates ok
            if (callback) process.nextTick (callback);
            return;
        }
        var err = new ValidationError (
            'MISSING',
            undefined,
            undefined,
            this.path,
            'input value undefined'
        );
        if (callback) return process.nextTick (function(){ callback (err); });
        throw err;
    }

    if (this.constraints.value) {
        if (!matchLeaves (value, this.constraints.value)) {
            var err = new ValidationError (
                'FORMAT',
                this.constraints.value,
                value,
                this.path,
                'did not match prescribed exact value'
            );
            if (callback) return process.nextTick (function(){ callback (err); });
            throw err;
        }

        if (callback) return process.nextTick (callback);
        return true;
    }

    var valtype = getTypeStr (value);
    var constrainedType = this.constraints.type;

    // check integer and process as numbers
    if (constrainedType == 'integer' && valtype == 'number') {
        if (Math.floor (value) != value) {
            var err = new ValidationError (
                'INVALID',
                'integer',
                value,
                this.path,
                'number value is not an integer'
            );
            if (callback) return process.nextTick (function(){ callback (err); });
            throw err;
        }
        // it's cool, process it as a number
        constrainedType = 'number';
    }

    if (
        constrainedType !== undefined
     && (valtype != constrainedType || !TYPE_VALIDATORS.hasOwnProperty (valtype))
    ) {
        var err = new ValidationError (
            'TYPE',
            constrainedType,
            value,
            this.path,
            'type mismatch'
        );
        if (callback) return process.nextTick (function(){ callback (err); });
        throw err;
    }

    var validator = TYPE_VALIDATORS[valtype];
    // async
    // if (callback && this.isAsync) {
    if (callback) { // non-optimized channel for testing only
        function finalCall (err) {
            if (err) return callback (err);

            var jobs = [];
            if (self.constraints.anyOf)
                jobs.push (function (callback) {
                    var first = self.constraints.anyOf.length;
                    var initial = first;
                    async.times (first, function (anyI, callback) {
                        self.constraints.anyOf[anyI].validate (value, function (err) {
                            if (err) return callback();
                            if (anyI < first)
                                first = anyI;
                            callback();
                        });
                    }, function(){
                        if (first == initial)
                            return process.nextTick (function(){
                                callback (new ValidationError (
                                    'FORMAT',
                                    self.constraints.anyOf,
                                    value,
                                    self.path,
                                    'failed .anyOf validation'
                                ));
                            });
                        callback();
                    });
                });

            if (self.constraints.oneOf)
                jobs.push (function (callback) {
                    var found = false;
                    async.each (self.constraints.oneOf, function (subschema, callback) {
                        subschema.validate (value, function (err) {
                            if (err) return callback();
                            if (found)
                                return callback (new ValidationError (
                                    'FORMAT',
                                    self.constraints.anyOf,
                                    value,
                                    self.path,
                                    'failed .oneOf validation - too many valid schema'
                                ));
                            found = true;
                            callback();
                        });
                    }, function (err) {
                        if (err)
                            return callback (err);
                        if (!found)
                            return callback (new ValidationError (
                                'FORMAT',
                                self.constraints.anyOf,
                                value,
                                self.path,
                                'failed .oneOf validation - no valid schema'
                            ));
                        callback();
                    });
                });

            if (self.constraints.not)
                jobs.push (function (callback) {
                    self.constraints.not.validate (value, function (err) {
                        if (err)
                            return callback();
                        callback (new ValidationError (
                            'FORMAT',
                            self.constraints.not,
                            value,
                            self.path,
                            '.not schema validated'
                        ));
                    });
                });

            async.parallel (jobs, function (err) {
                if (err) return process.nextTick (function(){ callback (err); });
                process.nextTick (callback);
            });
        }
        try {
            return validator.call (this, value, function (err) {
                if (err)
                    return process.nextTick (function(){ finalCall (err); });

                if (!self.constraints.eval)
                    return process.nextTick (finalCall);
                if (self.constraints.async)
                    try {
                        return self.constraints.eval (value, function (err) {
                            finalCall (err);
                        });
                    } catch (err) {
                        return process.nextTick (function(){ finalCall (err); });
                    }
                try {
                    self.constraints.eval (value);
                    return process.nextTick (finalCall);
                } catch (err) {
                    return process.nextTick (function(){ finalCall (new ValidationError (
                        'INVALID',
                        self.constraints.eval,
                        value,
                        self.path,
                        '.eval constraint rejected the value',
                        err
                    )); });
                }
            });
        } catch (err) {
            return process.nextTick (function(){ finalCall (err); });
        }
    }

    // sync
    try {
        validator.call (this, value);
        if (this.constraints.eval)
            if (this.constraints.async)
                throw new ValidationError (
                    'SYNC',
                    undefined,
                    value,
                    this.path,
                    'asynchronous .eval constraint called synchronously'
                );
            else try {
                this.constraints.eval (value);
            } catch (err) {
                throw new ValidationError (
                    'INVALID',
                    this.constraints.eval,
                    value,
                    this.path,
                    'failed .eval validation',
                    err
                );
            }

        if (this.constraints.anyOf) {
            var ok = false;
            for (var i=0, j=this.constraints.anyOf.length; i<j; i++)
                try {
                    var constraint = this.constraints.anyOf[i];
                    this.constraints.anyOf[i].validate (value);
                    ok = true;
                    break;
                } catch (err) { /* nobody cares */ }
            if (!ok)
                throw new ValidationError (
                    'FORMAT',
                    this.constraints.anyOf,
                    value,
                    this.path,
                    'failed .anyOf validation'
                );
        }

        var found = false;
        var BOGUS = {};
        if (this.constraints.oneOf) {
            for (var i=0, j=this.constraints.oneOf.length; i<j; i++)
                try {
                    this.constraints.oneOf[i].validate (value);
                    if (found)
                        throw BOGUS;
                    found = true;
                } catch (err) {
                    if (err === BOGUS)
                        throw new ValidationError (
                            'FORMAT',
                            this.constraints.oneOf,
                            value,
                            this.path,
                            'failed .oneOf validation - too many valid schema'
                        );

                }
            if (!found)
                throw new ValidationError (
                    'FORMAT',
                    this.constraints.oneOf,
                    value,
                    this.path,
                    'failed .oneOf validation - no valid schema'
                );
        }

        if (this.constraints.not) {
            var doThrow = false;
            try {
                this.constraints.not.validate (value);
                doThrow = true;
            } catch (err) { /* nobody cares */ }
            if (doThrow)
                throw new ValidationError (
                    'FORMAT',
                    this.constraints.not,
                    value,
                    this.path,
                    '.not schema validated'
                );
        }
    } catch (err) {
        if (callback)
            return process.nextTick (function(){ callback (err); });
        throw err;
    }

    if (callback)
        return process.nextTick (callback);
    return this;
};

module.exports = validate;
