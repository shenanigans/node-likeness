
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
var getTypeStr = require ('./GetTypeStr');
var TYPE_TRANSFORMERS = require ('./TypeTransformers');
var ValidationError = require ('./errors').ValidationError;
var TransformError = require ('./errors').TransformError;


function transform (value, target, mongoloid, callback) {
    if (typeof target == 'function') {
        callback = target;
        target = undefined;
        mongoloid = undefined;
    } else if (typeof mongoloid == 'function') {
        callback = mongoloid;
        mongoloid = undefined;
    }

    if (this.isAsync && !callback)
        throw new TransformError (
            'SYNC',
            value,
            this.path,
            'asynchronous schema transform requires a callback'
        );

    var valtype = getTypeStr (value);
    // if unknown type or type does not match .type AND is not a valid casting opportunity
    if (
        !TYPE_TRANSFORMERS.hasOwnProperty (valtype)
     || (
            this.constraints.type !== undefined
         && valtype != this.constraints.type
         && (valtype != 'string' || (
                !this.constraints.cast
             && !this.constraints.split
             && !this.constraints.group
            ))
        )
    ) {
        var err = new TransformError (
            'TYPE',
            value,
            this.path,
            'input value type mismatch',
            new ValidationError ('TYPE', this.constraints.type, value, this.path, 'type mismatch')
        );
        if (callback) return process.nextTick (function(){ callback (err); });
        throw err;
    }

    var canonType = this.constraints.type || valtype;
    if (!target)
        if (canonType == 'object')
            target = {};
        else if (canonType == 'array')
            target = [];

    // prefer constrained type, to target casts correctly
    var transformer = TYPE_TRANSFORMERS[canonType];

    // async
    if (callback) {
        var self = this;
        try {
            transformer.call (this, value, target, mongoloid, function (err, newVal) {
                if (err)
                    return process.nextTick (function(){ callback (err); });

                if (!self.constraints.eval)
                    return process.nextTick (function(){ callback (undefined, newVal); });
                if (self.constraints.async)
                    try {
                        return self.constraints.eval (target, function (err) {
                            process.nextTick (function(){ callback (err, newVal); });
                        });
                    } catch (err) {
                        return process.nextTick (function(){ callback (err); });
                    }
                try {
                    self.constraints.eval (target);
                    return process.nextTick (function(){ callback (undefined, newVal); });
                } catch (err) {
                    return process.nextTick (function(){ callback (err); });
                }
            });
        } catch (err) {
            return process.nextTick (function(){ callback (err); });
        }
        return;
    }

    // sync
    var newVal = transformer.call (this, value, target, mongoloid);

    if (this.constraints.eval)
        try {
            this.constraints.eval (value);
        } catch (err) {
            throw new TransformError (
                'INVALID',
                value,
                this.path,
                'failed .eval validation',
                new ValidationError (
                    'INVALID',
                    this.constraints.eval,
                    value,
                    this.path,
                    '.eval constraint threw an Error',
                    err
                )
            );
        }

    if (this.constraints.transform)
        try {
            newVal = this.constraints.transform (value);
        } catch (err) {
            throw new TransformError (
                'INVALID',
                value,
                this.path,
                '.transform function rejected the input value',
                err
            );
        }

    return newVal;
};

module.exports = transform;
