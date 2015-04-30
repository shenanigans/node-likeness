
/**     @member/Function likeness#validate
    Determine whether the provided document meets the configured constraints. Terminates validation
    at the first failure by throwing an Error.
@argument value
*/

var getTypeStr = require ('./GetTypeStr');
var TYPE_VALIDATORS = require ('./TypeValidators');
var ValidationError = require ('./errors').ValidationError;
var matchLeaves = require ('./Sorting').matchLeaves;

function validate (value) {
    var self = this;

    if (this.constraints.invalid)
        throw new Error ('invalid path');

    if (this.constraints.recurse)
        return this.constraints.recurse.validate (value);

    if (value === undefined) {
        if (this.constraints.optional) {
            // optional value is missing, validates ok
            return true;
        }
        throw new Error ('input value undefined');
    }

    if (this.constraints.value) {
        if (value !== this.constraints.value && !matchLeaves (value, this.constraints.value))
            throw new Error ('did not match prescribed exact value');

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
            throw new Error ('type mismatch');
    } else if (constrainedType == 'integer' && valtype == 'number') {
        // check integer and process as numbers
        if (Math.floor (value) != value)
            throw new Error ('number value is not an integer');

        // it's ok, process it as a number
        constrainedType = 'number';
    }

    if (this.constraints.type == 'null')
        if (value === null)
            return;
        else
            throw new Error ('value was not null');

    if (this.constraints.type == 'boolean')
        if (typeof value == 'boolean')
            return;
        else
            throw new Error ('type mismatch');

    if (
        constrainedType !== undefined
     && (valtype != constrainedType || !TYPE_VALIDATORS.hasOwnProperty (valtype))
    )
        throw new Error ('type mismatch');

    TYPE_VALIDATORS[valtype].call (this, value);

    if (this.constraints.eval)
        this.constraints.eval (value);

    if (this.constraints.anyOf) {
        var ok = false;
        var anyOf = this.constraints.anyOf;
        for (var i=0, j=anyOf.length; i<j; i++)
            if ( (function(){
                try {
                    anyOf[i].validate (value);
                    ok = true;
                    return true;
                } catch (err) { return false; }
            })() )
                break;
        if (!ok)
            throw new Error ('failed .anyOf validation');
    }

    if (this.constraints.oneOf) {
        var found = false;
        var BOGUS = {};
        var oneOf = this.constraints.oneOf;
        for (var i=0, j=oneOf.length; i<j; i++)
            (function(){
                try {
                    oneOf[i].validate (value);
                    if (found)
                        throw BOGUS;
                    found = true;
                } catch (err) {
                    if (err === BOGUS)
                        throw new Error ('failed .oneOf validation - too many valid schema');
                }
            })();
        if (!found)
            throw new Error ('failed .oneOf validation - no valid schema');
    }

    if (this.constraints.not) {
        var doThrow = false;
        var not = this.constraints.not;
        (function(){
            try {
                not.validate (value);
                doThrow = true;
            } catch (err) { /* nobody cares */ }
        })();
        if (doThrow)
            throw new Error ('.not schema validated');
    }

    return true;
};

module.exports = validate;
