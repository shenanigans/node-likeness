
var getTypeStr = require ('./GetTypeStr');
var TYPE_TRANSFORMERS = require ('./TypeTransformers');
var ValidationError = require ('./errors').ValidationError;
var TransformError = require ('./errors').TransformError;

/**     @member/Function likeness#transform
    Create a new document representing the data from one provided document accumulated into another,
    using transform constraints defined by this Likeness. Honors validation constraints on the
    result document (and *not* on the input document) to ensure that only validating documents are
    produced.
@argument target
    Original/accumulated document onto which the transform is applied to create a result document.
@argument value
    Source document to merge into `target`.
@callback
    @optional
    If present, the callback will always be honored. However, it is only necessary if this
    `likeness` has an asynchronous transform operation.
    @argument/Error|undefined err
        If the transform failed because of issues with the input or result documents, an [error
        report](likeness.TransformError) is passed.
    @argument newValue
        The new value produced by this Likeness' transform constraints.
    @returns
@returns
    If no callback was provided (and this Likeness is not asynchronous) returns the transformed
    value.
*/
function transform (/* target, value, path, root */) {
    var target, value, path, root;
    switch (arguments.length) {
        case 4:
            root = arguments[3];
        case 3:
            path = arguments[2];
        case 2:
            value = arguments[1];
            target = arguments[0];
            break;
        default:
            value = arguments[0];
    }
    path = path || this.path;
    if (root === undefined)
        root = value;

    if (this.constraints.invalid)
        throw new Error ('invalid path');

    if (this.constraints.type == 'null') {
        if (value === null)
            return null;
        throw new Error ('value was not null');
    }

    if (this.constraints.recurse)
        return this.constraints.recurse.transform (target, value, path, root);

    if (this.constraints.transform)
        value = this.constraints.transform (value);

    if (this.constraints.asElem)
        value = [ value ];
    var valtype = getTypeStr (value);
    var constrainedType = this.constraints.type;
    if (constrainedType instanceof Array) {
        var found = false;
        if (valtype == 'number') {
            // extra tricky due to integer type
            for (var i=0,j=constrainedType.length; i<j; i++) {
                var candidate = constrainedType[i];
                if (
                    candidate == 'number'
                 || ( candidate == 'integer' && Math.floor (value) == value )
                ) {
                    constrainedType = candidate;
                    found = true;
                    break;
                }
            }
        } else
            for (var i=0,j=constrainedType.length; i<j; i++)
                if (constrainedType[i] == valtype) {
                    constrainedType = valtype;
                    found = true;
                    break;
                }

        if (!found)
            throw new Error ('type mismatch');
    }

    var isInt = false;
    // check integer and process as numbers
    if (constrainedType == 'integer' && valtype == 'number') {
        // process it as a number until the end
        constrainedType = 'number'
        isInt = true;
    }

    // if not a valid casting opportunity AND unknown type, does not match .type or source/target conflict
    if (
        !TYPE_TRANSFORMERS.hasOwnProperty (valtype)
     || (
            (valtype != 'string' || (
                !this.constraints.cast
             && !this.constraints.split
             && !this.constraints.group
            ))
         && (
                (
                    constrainedType !== undefined
                 && valtype != constrainedType
                )
             || (
                    target !== undefined
                 && valtype != getTypeStr (target)
                )
            )
        )
    )
        throw new Error ('type mismatch');

    var canonType = constrainedType || valtype;
    if (!target)
        if (canonType == 'object')
            target = {};
        else if (canonType == 'array')
            target = [];

    // prefer constrained type, to target casts correctly
    var newVal = TYPE_TRANSFORMERS[canonType]
        .call (this, target, value, path, root)
        ;

    if (isInt && Math.floor (newVal) != newVal)
        throw new Error ('transform produced a non-integer value');

    if (this.constraints.eval)
        this.constraints.eval (value);

    if (this.constraints.anyOf) {
        var ok = false;
        var anyOf = this.constraints.anyOf;
        for (var i=0, j=anyOf.length; i<j; i++)
            if ( (function(){
                try {
                    var constraint = anyOf[i];
                    newVal = anyOf[i].transform (target, newVal, path, root);
                    ok = true;
                    return true;
                } catch (err) { return false; }
            })() )
                break;
        if (!ok)
            throw new Error ('failed .anyOf transforms');
    }

    var found = false;
    var BOGUS = {};
    if (this.constraints.oneOf) {
        var oneOf = this.constraints.oneOf;
        for (var i=0, j=oneOf.length; i<j; i++)
            (function(){
                try {
                    newVal = oneOf[i].transform (target, newVal, path, root);
                    if (found)
                        throw BOGUS;
                    found = true;
                } catch (err) {
                    if (err === BOGUS)
                        throw new Error ('failed .oneOf transform - too many matching schemata');
                }
            })();
        if (!found)
            throw new Error ('failed .oneOf transform - no matching schema');
    }

    if (this.constraints.not) {
        var doThrow = false;
        var not = this.constraints.not;
        (function(){
            try {
                not.transform (target, newVal, path, root);
                doThrow = true;
            } catch (err) { /* nobody cares */ }
            if (doThrow)
                throw new Error ('.not schema validated');
        })();
    }

    return newVal;
};

module.exports = transform;
