
/**     @module|class likeness.helpers
    A variety of helpful functions for creating [Configuration](likeness.Configuration) Objects.
    These are meant to be used within a normal instantiation. For example:
    ```javascript
    // an Array, containing between 10 and 256 integers 0-100
    // with at least one value greater than 20
    var schema = new likeness (likeness.helpers.Arr (10, 256,
        likeness.helpers.Num (0, 100, { '.family':'int' }),
        {
            '.exists':  likeness.helpers.Num ({ '.greaterThan':20 })
        }
    ));
    ```
*/
var Likeness = require ('./likeness');


/**     @property/Function Str
    Create a String constraint with minimum and maximum length.
@argument/Number min
    @optional
@argument/Number max
    @optional
@argument/Object options
    @optional
    Children and additional options.
*/
function Str (min, max, options) {
    if (!max) {
        max = min;
        min = undefined;
    } else if (!options) {
        options = max;
        max = min;
        min = undefined;
    }

    options = options || {};
    options['.type'] = 'string';

    if (min !== undefined) options['.min'] = min;
    if (max !== undefined) options['.max'] = max;

    return new Likeness (options);
}


/**     @property/Function Num
    Create a Number constraint with minimum and maximum values.
@argument/Number min
    @optional
@argument/Number max
    @optional
@argument/Object options
    @optional
    Additional options.
*/
function Num (min, max, options) {
    if (!max) {
        max = min;
        min = undefined;
    } else if (!options) {
        options = max;
        max = min;
        min = undefined;
    }

    options = options || {};
    options['.type'] = 'number';

    if (min !== undefined) options['.min'] = min;
    if (max !== undefined) options['.max'] = max;

    return new Likeness (options);
}


/**     @property/Function Async
    Create an asynchronous Function constraint.
@argument/String type
    @optional
    The expected JSON type of the input value.
@callback call
    @argument/Object|Array|Number|String|Boolean value
    @callback
        @argument/Error|undefined err
        @argument/Boolean|undefined isValid
        @returns
    @returns
@argument/Object options
    @optional
    Children and additional options. If the value is an [Object]() and the call validates, children
    are validated normally.
*/
function Async (type, call, options) {
    if (!options) {
        options = call;
        call = type;
        type = undefined;
    }

    options = options || {};
    options['.type'] = type;

    options['.function'] = call;
    options['.async'] = true;

    return new Likeness (options);
}


/**     @property/Function Arr

@argument/Object|Array|Number|String|Boolean allSchema
    @optional
@argument/Array|undefined sequence
    @optional
@argument/Object options
    @optional
    Children and additional options.
*/
function Arr (allSchema, sequence, options) {
    if (!sequence) {
        sequence = allSchema;
        allSchema = undefined;
    } else if (!options) {
        options = sequence;
        sequence = allSchema;
        allSchema = undefined;
    }

    options = options || {};
    options['.type'] = 'array';

    if (allSchema !== undefined) options['.all'] = allSchema;
    if (sequence !== undefined) options['.sequence'] = sequence;

    return new Likeness (options);
}


/**     @property/Function Joker
    Create a schema that represents arbitrary data of any type.
@argument/Boolean optional
    @optional
    Whether the Joker even needs to exist.
*/
function Joker (optional) {
    var options = { '.adHoc':true };
    if (optional) optional['.optional'] = true;

    return new Likeness (options);
}


module.exports.Str = Str;
module.exports.Num = Num;
module.exports.Async = Async;
module.exports.Arr = Arr;
