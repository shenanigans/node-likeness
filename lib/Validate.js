
/**     @member/Function likeness#validate
    Determine whether the provided document meets the configured constraints. Terminates validation
    at the first failure by throwing an Error.
@argument value
*/

var getTypeStr = require ('./GetTypeStr');
var TYPE_VALIDATORS = require ('./TypeValidators');
var matchLeaves = require ('./Sorting').matchLeaves;

function validate (value, errContext) {
    var errMessage = this.constraints.error || errContext;

    if (this.constraints.invalid)
        throw errMessage || 'invalid path';

    if (this.constraints.recurse)
        return this.constraints.recurse.validate (value, errContext);

    if (value === undefined) {
        if (this.constraints.optional) {
            // optional value is missing, validates ok
            return true;
        }
        throw errMessage || 'input value undefined';
    }

    if (this.constraints.value) {
        if (value !== this.constraints.value && !matchLeaves (value, this.constraints.value))
            throw errMessage || 'did not match prescribed exact value';

        return true;
    }

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
    } else if (constrainedType == 'integer' && valtype == 'number') {
        // check integer and process as numbers
        if (Math.floor (value) != value)
            throw errMessage || 'number value is not an integer';

        // it's ok, process it as a number
        constrainedType = 'number';
    }

    if (this.constraints.type == 'null')
        if (value === null)
            return;
        else
            throw errMessage || 'value was not null';

    if (this.constraints.type == 'boolean')
        if (typeof value == 'boolean')
            return;
        else
            throw errMessage || 'type mismatch';

    if (
        constrainedType !== undefined
     && (valtype != constrainedType || !TYPE_VALIDATORS.hasOwnProperty (valtype))
    )
        throw errMessage || 'type mismatch';

    TYPE_VALIDATORS[valtype].call (this, value, errMessage);

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
                    anyOf[i].validate (value, errMessage);
                    ok = true;
                    return true;
                } catch (err) { return false; }
            })() )
                break;
        if (!ok)
            throw errMessage || 'failed .anyOf validation';
    }

    if (this.constraints.oneOf) {
        var found = false;
        var BOGUS = {};
        var oneOf = this.constraints.oneOf;
        for (var i=0, j=oneOf.length; i<j; i++)
            (function(){
                try {
                    oneOf[i].validate (value, errMessage);
                    if (found)
                        throw BOGUS;
                    found = true;
                } catch (err) {
                    if (err === BOGUS)
                        throw errMessage || 'failed .oneOf validation - too many valid schema';
                }
            })();
        if (!found)
            throw errMessage || 'failed .oneOf validation - no valid schema';
    }

    if (this.constraints.not) {
        var doThrow = false;
        var not = this.constraints.not;
        (function(){
            try {
                not.validate (value, errMessage);
                doThrow = true;
            } catch (err) { /* nobody cares */ }
        })();
        if (doThrow)
            throw errMessage || '.not schema validated';
    }

    return true;
};

module.exports = validate;
