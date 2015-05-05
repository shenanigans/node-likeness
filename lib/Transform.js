
var getTypeStr = require ('./GetTypeStr');
var TYPE_TRANSFORMERS = require ('./TypeTransformers');
var ValidationError = require ('./errors').ValidationError;
var TransformError = require ('./errors').TransformError;

var dayNames = [ 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday' ];

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
function transform (/* target, value, root, errContext */) {
    var target, value, root, errContext;
    if (arguments.length == 1)
        value = arguments[0];
    else {
        errContext = arguments[3];
        root = arguments[2];
        value = arguments[1];
        target = arguments[0];
    }
    if (root === undefined)
        root = value;
    var errMessage = this.constraints.error || errContext;

    if (this.constraints.invalid)
        throw errMessage || 'invalid path';

    if (this.constraints.type == 'null') {
        if (value === null)
            return null;
        throw errMessage || 'value was not null';
    }

    if (this.constraints.recurse)
        return this.constraints.recurse.transform (target, value, root, errMessage);

    if (this.constraints.transform) {
        var op = this.constraints.transform;
        (function(){
            try {
                value = op (target, value);
            } catch (err) {
                throw errMessage || 'transform function failed';
            }
        })();
    }

    if (this.constraints.cast)
        (function(){
            try {
                value = JSON.parse (value);
            } catch (err) {
                throw errMessage || 'failed to cast value from String';
            }
        })();

    // date conversion
    if (this.isDateConverter) {
        (function(){
            try {
                value = new Date (value);
            } catch (err) {
                throw errMessage || 'invalid date';
            }
        })();

        if (this.constraints.getYear)
            value = new Date (Date.UTC (
                value.getFullYear()
            )).getTime();
        else if (this.constraints.getYearName)
            value = String (new Date (Date.UTC (
                value.getFullYear()
            )).getFullYear());
        else if (this.constraints.getMonth)
            value = new Date (Date.UTC (
                value.getFullYear(), value.getMonth()
            )).getTime();
        else if (this.constraints.getMonthName)
            value = String (new Date (Date.UTC (
                value.getFullYear(), value.getMonth()
            )).getFullYear());
        else if (this.constraints.getDay)
            value = new Date (Date.UTC (
                value.getFullYear(), value.getMonth(), value.getDate()
            )).getTime();
        else if (this.constraints.getDayNum)
            value = value.getDate();
        else if (this.constraints.getDayName)
            value = dayNames[value.getDay()];
    }

    if (this.constraints.total && value instanceof Array) {
        var total = 0;
        for (var i=0,j=value.length; i<j; i++)
            total += value[i];
        value = total;
    }

    if (this.constraints.mean && value instanceof Array) {
        var total = 0;
        for (var i=0,j=value.length; i<j; i++)
            total += value[i];
        value = total / value.length;
    }

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
            throw errMessage || 'type mismatch';
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
        throw errMessage || 'type mismatch';

    // prefer constrained type, to target casts correctly
    var canonType = constrainedType || valtype;

    // missing target for Object and Array
    if (!target)
        if (canonType == 'object')
            target = {};
        else if (canonType == 'array')
            target = [];

    var newVal = TYPE_TRANSFORMERS[canonType]
        .call (this, target, value, root, errMessage)
        ;

    if (isInt && Math.floor (newVal) != newVal)
        throw errMessage || 'transform produced a non-integer value';

    if (this.constraints.eval) {
        var op = this.constraints.eval;
        (function(){
            try {
                op (value);
            } catch (err) {
                throw errMessage || '.eval validation failed';
            }
        })();
    }

    if (this.constraints.anyOf) {
        var ok = false;
        var anyOf = this.constraints.anyOf;
        for (var i=0, j=anyOf.length; i<j; i++)
            if ( (function(){
                try {
                    var constraint = anyOf[i];
                    newVal = anyOf[i].transform (target, newVal, root, errMessage);
                    ok = true;
                    return true;
                } catch (err) { return false; }
            })() )
                break;
        if (!ok)
            throw errMessage || 'failed .anyOf transforms';
    }

    var found = false;
    var BOGUS = {};
    if (this.constraints.oneOf) {
        var oneOf = this.constraints.oneOf;
        for (var i=0, j=oneOf.length; i<j; i++)
            (function(){
                try {
                    newVal = oneOf[i].transform (target, newVal, root, errMessage);
                    if (found)
                        throw BOGUS;
                    found = true;
                } catch (err) {
                    if (err === BOGUS)
                        throw errMessage || 'failed .oneOf transform - too many matching schemata';
                }
            })();
        if (!found)
            throw errMessage || 'failed .oneOf transform - no matching schema';
    }

    if (this.constraints.not) {
        var doThrow = false;
        var not = this.constraints.not;
        (function(){
            try {
                not.transform (target, newVal, root, errMessage);
                doThrow = true;
            } catch (err) { /* nobody cares */ }
            if (doThrow)
                throw errMessage || '.not schema validated';
        })();
    }

    return newVal;
};

module.exports = transform;
