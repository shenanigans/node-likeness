
/**     @member/Function likeness#report
    Determine whether the provided document meets the configured restraints. If an Error occurs,
    continue processing and return every Error encountered as an Array.
@argument value
@callback
    @optional
    If present, the callback will always be honored. However, it is only necessary if this
    `likeness` has an asynchronous validation operation.
    @argument/Error|undefined err
    @argument/Boolean|undefined isValid
    @returns
@returns/Array|undefined
    Returns an Array of every error that occured, or `undefined` if none occured.
*/

var async = require ('async');
var getTypeStr = require ('./GetTypeStr');
var TYPE_REPORTERS = require ('./TypeReporters');
var ValidationError = require ('./errors').ValidationError;

function report (value, errors, callback) {
    if (!errors) errors = [];
    var self = this;

    if (value === undefined) {
        if (this.constraints.optional) {
            // optional value is missing, validates ok
            if (callback) return process.nextTick (callback);
            return;
        }
        errors.push (new ValidationError (
            'MISSING',
            undefined,
            undefined,
            this.path,
            'input value undefined'
        ));
        if (callback) return process.nextTick (function(){ callback (errors); });
        return errors;
    }

    var valtype = getTypeStr (value);
    if (
        ( this.constraints.type !== undefined && valtype != this.constraints.type )
     || !TYPE_REPORTERS.hasOwnProperty (valtype)
    ) {
        errors.push (new ValidationError (
            'TYPE',
            this.constraints.type,
            value,
            this.path,
            'type mismatch'
        ));
        // we do NOT proceed beyond a type mismatch
        if (callback) return process.nextTick (function(){ callback (errors); });
        return errors;
    }

    var reporter = TYPE_REPORTERS[valtype];
    // async
    if (callback)
        return reporter.call (this, value, errors, function(){
            if (!self.constraints.eval)
                return process.nextTick (callback);
            if (self.constraints.async)
                return self.constraints.eval (value, function (err) {
                    if (err)
                        errors.push (new ValidationError (
                            'INVALID',
                            self.constraints.type,
                            value,
                            self.path,
                            '.eval constraint rejected the value',
                            err
                        ));
                    process.nextTick (callback);
                });
            try {
                self.constraints.eval (value)
            } catch (err) {
                errors.push (new ValidationError (
                    'INVALID',
                    self.constraints.type,
                    value,
                    self.path,
                    '.eval constraint rejected the value',
                    err
                ));
            }
            return process.nextTick (callback);
        });

    // sync
    reporter.call (this, value, errors);
    if (this.constraints.eval)
        if (this.constraints.async)
            errors.push (new ValidationError (
                'SYNC',
                undefined,
                value,
                this.path,
                'asynchronous .eval constraint called synchronously'
            ));
        else try {
            this.constraints.eval (value);
        } catch (err) {
            errors.push (new ValidationError (
                'INVALID',
                this.constraints.eval,
                value,
                this.path,
                'failed .eval validation',
                err
            ));
        }
};

module.exports = report;
