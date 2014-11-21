
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

var TYPE_VALIDATORS = require ('./TypeValidators');

function validate (value, callback) {
    var self = this;

    if (value === undefined) {
        if (this.constraints.optional) {
            // optional value is missing, validates ok
            if (callback) process.nextTick (callback);
            return;
        }
        var err = {
            error:  'missing',
            msg:    'input value undefined',
            value:  undefined
        };
        if (callback) return process.nextTick (function(){ callback (err); });
        throw err;
    }

    var valtype = getTypeStr (value);
    if (
        ( this.constraints.type !== undefined && valtype != this.constraints.type )
     || !TYPE_VALIDATORS.hasOwnProperty (valtype)
    ) {
        var err = {
            error:      'type',
            msg:        'type mismatch',
            constraint: this.constraints.type,
            value:      value
        };
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
                    return process.nextTick (function(){ callback (err); });
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
            throw {
                error:  'sync',
                msg:    'asynchronous .eval constraint called synchronously'
            };
        else
            this.constraints.eval (value);
};

module.exports = validate;
