
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


function transform (value, target, mongoloid, callback, path) {
    if (arguments.length == 3) {
        if ((typeof mongoloid) == 'function') {
            callback = mongoloid;
            mongoloid = undefined;
        } else if ((typeof mongoloid) == 'string') {
            path = mongoloid;
            mongoloid = undefined;
        }
    } else if (arguments.length == 4) {
        if ((typeof mongoloid) == 'function') {
            callback = mongoloid;
            mongoloid = undefined;
        }
        if ((typeof callback) == 'string') {
            path = callback;
            callback = undefined;
        }
    }

    if (this.constraints.recurse)
        return this.constraints.recurse.transform (value, target, mongoloid, callback, path);

    if (this.isAsync && !callback)
        throw new TransformError (
            'SYNC',
            value,
            path,
            'asynchronous schema transform requires a callback'
        );

    var valtype = getTypeStr (value);
    path = path || this.path;
    var constrainedType = this.constraints.type;
    var isInt = false;

    // check integer and process as numbers
    if (constrainedType == 'integer' && valtype == 'number') {
        // process it as a number until the end
        constrainedType = 'number'
        isInt = true;
    }

    // if unknown type or type does not match .type AND is not a valid casting opportunity
    if (
        !TYPE_TRANSFORMERS.hasOwnProperty (valtype)
     || (
            constrainedType !== undefined
         && valtype != constrainedType
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
            path,
            'input value type mismatch',
            new ValidationError (
                'TYPE',
                this.constraints.type,
                value,
                path,
                'type mismatch'
            )
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
    if (callback && this.isAsync) {
        var self = this;
        function finalCheck (err, newVal) {
            if (err) return callback (err);
            if (isInt && Math.floor (newVal) != newVal)
                return callback (new TransformError (
                    'INVALID',
                    value,
                    path,
                    'transform produced a non-integer value'
                ));
            callback (undefined, newVal);
        }

        try {
            transformer.call (this, value, target, mongoloid, function (err, newVal) {
                if (err)
                    return process.nextTick (function(){ callback (err); });

                if (self.constraints.transform)
                    if (self.constraints.async)
                        return self.constraints.transform (newVal, function (err, newVal) {
                            if (err)
                                return process.nextTick (function(){
                                    callback (new TransformError (
                                        'INVALID',
                                        value,
                                        path,
                                        '.transform function rejected the input value',
                                        err
                                    ));
                                });
                            if (!self.constraints.eval)
                                return process.nextTick (function(){ finalCheck (undefined, newVal); });
                            if (self.constraints.async)
                                try {
                                    return self.constraints.eval (target, function (err) {
                                        process.nextTick (function(){ finalCheck (err, newVal); });
                                    });
                                } catch (err) {
                                    return process.nextTick (function(){ callback (err); });
                                }
                            try {
                                self.constraints.eval (target);
                                process.nextTick (function(){ finalCheck (undefined, newVal); });
                            } catch (err) {
                                process.nextTick (function(){ callback (err); });
                            }
                        });
                    else
                        try {
                            newVal = self.constraints.transform (newVal);
                        } catch (err) {
                            return callback (new TransformError (
                                'INVALID',
                                value,
                                path,
                                '.transform function rejected the input value',
                                err
                            ));
                        }

                if (!self.constraints.eval)
                    return process.nextTick (function(){ finalCheck (undefined, newVal); });
                if (self.constraints.async)
                    try {
                        return self.constraints.eval (target, function (err) {
                            process.nextTick (function(){ finalCheck (err, newVal); });
                        });
                    } catch (err) {
                        return process.nextTick (function(){ callback (err); });
                    }
                try {
                    self.constraints.eval (target);
                    return process.nextTick (function(){ finalCheck (undefined, newVal); });
                } catch (err) {
                    return process.nextTick (function(){ callback (err); });
                }
            }, path);
        } catch (err) {
            return process.nextTick (function(){
                callback (err);
            });
        }
        return;
    }

    // sync
    try {
        var newVal = transformer.call (this, value, target, mongoloid, undefined, path);

        if (isInt && Math.floor (newVal) != newVal)
            throw new TransformError (
                'INVALID',
                value,
                path,
                'transform produced a non-integer value'
            );

        if (this.constraints.transform)
            try {
                newVal = this.constraints.transform (value);
            } catch (err) {
                throw new TransformError (
                    'INVALID',
                    value,
                    path,
                    '.transform function rejected the input value',
                    err
                );
            }

        if (this.constraints.eval)
            try {
                this.constraints.eval (value);
            } catch (err) {
                throw new TransformError (
                    'INVALID',
                    value,
                    path,
                    'failed .eval validation',
                    new ValidationError (
                        'INVALID',
                        this.constraints.eval,
                        value,
                        path,
                        '.eval constraint threw an Error',
                        err
                    )
                );
            }
    } catch (err) {
        if (callback)
            return process.nextTick (function(){ callback (err); });
        throw err;
    }

    if (callback)
        return process.nextTick (function(){ callback (undefined, newVal); });
    return newVal;
};

module.exports = transform;
