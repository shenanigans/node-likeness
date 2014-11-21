
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

var TYPE_REPORTERS = require ('./TypeReporters');

function report (value, errors, callback) {
    if (!errors) errors = [];
    var self = this;

    if (value === undefined) {
        if (this.constraints.optional) {
            // optional value is missing, validates ok
            if (callback) return process.nextTick (callback);
            return;
        }
        errors.push ({
            error:  "missing",
            msg:    "value is undefined"
        });
        if (callback) return process.nextTick (function(){ callback (errors); });
        return errors;
    }

    var valtype = getTypeStr (value);
    if (this.constraints.type !== undefined && valtype != this.constraints.type) {
        errors.push ({
            error:          "type",
            msg:            "value type mismatch",
            constraint:     this.constraints.type,
            value:          value,
            type:           valtype
        });
        if (callback) return process.nextTick (function(){ callback (errors); });
        return errors;
    }
    if (!TYPE_REPORTERS.hasOwnProperty (valtype)) {
        errors.push ({
            error:          "type",
            msg:            "value type unknown",
            value:          value,
            type:           valtype
        });
        if (callback)
            return process.nextTick (function(){ callback (errors); });
        else
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
                        errors.push (err);
                    process.nextTick (callback);
                });
            try {
                self.constraints.eval (value)
            } catch (err) {
                errors.push (err);
                errors.push ({
                    error:  'format',
                    msg:    'evaluation function failed to process value',
                    value:  value,
                    jserr:  err
                });
            }
            return process.nextTick (callback);
        });

    // sync
    reporter.call (this, value, errors);
    if (this.constraints.eval)
        if (this.constraints.async)
            errors.push ({
                error:  'sync',
                msg:    'asynchronous .eval constraint called synchronously'
            });
        else try {
            this.constraints.eval (value);
        } catch (err) {
            errors.push (err);
            errors.push ({
                error:  'format',
                msg:    'evaluation function rejected value',
                value:  value
            });
        }
};

module.exports = report;
