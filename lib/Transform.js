
/**     @member/Function likeness#transform
    Confirm that the provided document meets the configured restraints and construct a second clone
    document modified by the configured transforms. This instance must be of Object or Array type.
    If an Error occurs, the transformation will fail immediately.

    You may provide an empty or non-empty Object
@argument/Object|Array document
@argument/Object|Array target
    @optional
    Validated and transformed values are safely cloned into the target. Must be the same type as
    `document` or an Error is immediately thrown.
@callback
    @optional
    If present, the callback will always be honored. However, it is only necessary if this
    `likeness` has an asynchronous transform operation.
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

var TYPE_TRANSFORMERS = require ('./TypeTransformers');
var TYPE_VALIDATORS = require ('./TypeValidators');

function transform (value, target, callback) {
    if (typeof target == 'function') {
        callback = target;
        target = {};
    }
    if (!target)
        target = {};


    if (value === undefined) {
        if (this.constraints.optional) {
            // optional value is missing, validates ok
            if (callback) process.nextTick (callback);
            return;
        }
        var err = {
            error:  'transform',
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
            error:      'transform',
            msg:        'input value type mismatch',
            source:     {
                error:      'type',
                msg:        'type mismatch',
                constraint: this.constraints.type,
                value:      value
            }
        };
        if (callback) return process.nextTick (function(){ callback (err); });
        throw err;
    }

    var transformer = TYPE_TRANSFORMERS[valtype];

    // async
    if (callback) {
        var self = this;
        try {
            return transformer.call (this, value, target, function (err, newValue) {
                if (err)
                    return process.nextTick (function(){ callback (err); });

                if (!self.constraints.eval)
                    return process.nextTick (function(){ callback (undefined, newValue); });
                if (self.constraints.async)
                    try {
                        return self.constraints.eval (target, function (err) {
                            process.nextTick (function(){ callback (err, newValue); });
                        });
                    } catch (err) {
                        return process.nextTick (function(){ callback (err); });
                    }
                try {
                    self.constraints.eval (target);
                    return process.nextTick (function(){ callback (undefined, newValue); });
                } catch (err) {
                    return process.nextTick (function(){ callback (err); });
                }
            });
        } catch (err) {
            return process.nextTick (function(){ callback (err); });
        }
    }

    // sync
    try {
        validator.call (this, value);
    } catch (err) {
        throw {
            error:  'transform',
            msg:    'source data leaf failed validation',
            source: err
        };
    }
    if (this.constraints.eval)
        if (this.constraints.async)
            throw {
                error:  'sync',
                msg:    'asynchronous .eval constraint called synchronously'
            };
        else try {
            this.constraints.eval (value);
        } catch (err) {
            throw {
                error:  'transform',
                msg:    'source data leaf failed .eval constraint',
                source: err
            };
        }

    return transformer.call (this, value, target);
};

module.exports = transform;
