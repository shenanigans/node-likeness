
/**     @member/Function likeness#validate
    Determine whether the provided document meets the configured restraints. If an Error occurs,
    terminates validation and returns the Error immediately.
@argument value
@callback
    @optional
    If present, the callback will always be honored. However, it is only necessary if this
    `likeness` has an asynchronous validation operation.
    @argument/Error|undefined err
    @argument/Boolean|undefined isValid
    @returns
@returns/Error|undefined
    Returns any Error that prevented transform completion, or `undefined` if none occured.
*/

var async = require ('async');
var getTypeStr = require ('./GetTypeStr');
var TYPE_VALIDATORS = require ('./TypeValidators');
var ValidationError = require ('./errors').ValidationError;

function validate (value, callback) {
    var self = this;

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

    var valtype = getTypeStr (value);
    if (
        ( this.constraints.type !== undefined && valtype != this.constraints.type )
     || !TYPE_VALIDATORS.hasOwnProperty (valtype)
    ) {
        var err = new ValidationError (
            'TYPE',
            this.constraints.type,
            value,
            this.path,
            'type mismatch'
        );
        if (callback) return process.nextTick (function(){ callback (err); });
        throw err;
    }

    var validator = TYPE_VALIDATORS[valtype];
    // async
    if (callback) {
        try {
            return validator.call (this, value, function (err) {
                if (err)
                    return process.nextTick (function(){ callback (err); });

                if (!self.constraints.eval)
                    return process.nextTick (callback);
                if (self.constraints.async)
                    try {
                        return self.constraints.eval (value, function (err) {
                            callback (err);
                        });
                    } catch (err) {
                        return process.nextTick (function(){ callback (err); });
                    }
                try {
                    self.constraints.eval (value);
                    return process.nextTick (callback);
                } catch (err) {
                    return process.nextTick (function(){ callback (new ValidationError (
                        'INVALID',
                        self.constraints.type,
                        value,
                        self.path,
                        '.eval constraint rejected the value',
                        err
                    )); });
                }
            });
        } catch (err) {
            return process.nextTick (function(){ callback (err); });
        }
    }

    // sync
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
                this.constraints.oneOf,
                value,
                this.path,
                '.not schema validated',
                err
            );
    }

    return this;
};

module.exports = validate;
