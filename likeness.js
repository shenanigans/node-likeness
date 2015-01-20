
/**     @module/class likeness

@argument schema
*/

var async = require ('async');

/**     @class Configuration

@String #type
@Function #eval
    Simply test document values with a [Function]() call. If the [async](Configuration#async)
    constraint is configured, a callback will be passed to the evaluation function.
    @argument/Object|Array|String|Number|Boolean value
    @callback
        @argument/Error|undefined err
        @argument/Boolean|undefined isValid
@Boolean #async
@Boolean #optional
    If `optional` is set `true`, the value `undefined` is always considered to be a valid document.
@Function #transform
@Object|Array|String|Number|Boolean #value
    Define a value which all valid documents must replicate exactly.
*/
/**     @class .Configuration.Object
    @super Configuration
@Number #min
    The minimum number of defined keys on the Object.
@Number #max
    The maximum number of defined keys on the Object.
*/
/**     @class .Configuration.Array
    @super Configuration
@Number #min
    The minimum number of defined values in the Array.
@Number #max
    The maximum number of defined values in the Array.
@.Configuration all
@.Configuration|Array[.Configuration]
@Array[.Configuration] sequence
*/
/**     @class .Configuration.String
    @super Configuration
@Number #min
    The minimum length of the String.
@Number #max
    The maximum length of the String.

*/
/**     @class .Configuration.Number
    @super Configuration
@Number #min
    The minimum value of the Number.
@Number #exclusiveMin
    The minimum value of the Number, exclusive.
@Number #max
    The maximum value of the Number.
@Number #exclusiveMax
    The maximum value of the Number, exclusive.
*/
/**     @class .Configuration.Boolean
    @super Configuration
*/

var getTypeStr = require ('./lib/GetTypeStr');

var SPECIAL_KEYS = {
    '.type':            'type',         // restrict document type
    '.adHoc':           'adHoc',        // accept unknown keys
    '.arbitrary':       'adHoc',
    '.tolerant':        'tolerant',     // ignore unknown keys
    '.optional':        'optional',     // accept `undefined` as a valid document
    '.optional':        'optional',
    '.optional':        'optional',
    '.key':             'keyTest',      // for matching arbitrary keys
    '.keyTest':         'keyTest',
    '.children':        'children',     // optional - this is the escape strategy for special keys
    '.child':           'children',
    '.min':             'min',          // min/max value, length, etc.
    '.max':             'max',
    '.exclusiveMin':    'exclusiveMin',
    '.exclusiveMax':    'exclusiveMax',
    '.minKeys':         'min',
    '.maxKeys':         'max',
    '.minVals':         'min',
    '.minValues':       'min',
    '.maxVals':         'max',
    '.maxValues':       'max',
    '.minLength':       'min',
    '.maxLength':       'max',
    '.greaterThan':     'exclusiveMin',
    '.gt':              'exclusiveMin',
    '.greaterOrEqual':  'min',
    '.gte':             'min',
    '.lessThan':        'exclusiveMax',
    '.lt':              'exclusiveMax',
    '.lessOrEqual':     'max',
    '.lte':             'max',
    '.mod':             'modulo',       // modulo
    '.modulo':          'modulo',       // modulo
    '.length':          'length',       // exact length match
    '.len':             'length',
    '.keys':            'length',
    '.vals':            'length',
    '.values':          'length',
    '.match':           'match',        // regex value matching (only available for .type="string")
    '.regex':           'match',
    '.regexp':          'match',
    '.eval':            'eval',         // call-the-function evaluation
    '.evaluate':        'eval',
    '.async':           'async',        // marks a `function` constraint as async
    '.exists':          'exists',       // at least one key/value matches the given schema
    '.thereExists':     'exists',
    '.times':           'times',        // modifies `exists` constraint - requires [times] keys to match
    '.all':             'all',          // every key/value matches the given schema
    '.forAll':          'all',
    '.every':           'all',
    '.forEvery':        'all',
    '.value':           'value',        // exact value match
    '.sequence':        'sequence',     // an Array of schema which must match sequentially
    //============================= Transforms!
    //      These don't evaluate documents, they transform valid documents
    '.cast':            'cast',         // convert strings to match .type
    '.set':             'setVal',       // hard overwrite
    '.inject':          'inject',       // insert hard data into input and overwrite target
    '.insert':          'insert',       // insert input into target at Array/String position
    '.append':          'append',       // append input to target Array/String
    '.prepend':         'prepend',      // prepend input to target Array/String
    '.normal':          'normal',       // normalize Numbers
    '.normalize':       'normal',
    '.normalization':   'normal',
    '.add':             'total',        // add input number to target
    '.total':           'total',
    '.subtract':        'subtract',     // subtract input number from target
    '.multiply':        'multiply',     // multiply target number by input
    '.divide':          'divide',       // divide target number by input
    '.modulate':        'modFilter',    // modulo input before overwriting target
    '.modFilter':       'modFilter',
    '.inverse':         'inverse',      // multiply by -1 (works for booleans)
    '.invert':          'inverse',
    '.reciprocal':      'reciprocal',   // 1/x
    '.split':           'split',        // regex split
    '.group':           'group',        // regex exec -> Array of groups
    '.case':            'case',         // transform string capitalization
    '.transform':       'transform',
    '.function':        'transform',
    '.filter':          'filter',       // pass key/index and value to function for selective drop
    '.rename':          'rename',       // rename a key
    '.drop':            'drop',         // drop a key
    '.clip':            'clip',         // restrict max length
    '.slice':           'slice'         // retain specific subsection
};


var Likeness = function (schema, path) {
    this.path = path;

    // convert any nodes which are not of Configuration type to their Configuration representations
    var type = getTypeStr (schema);
    if (type != 'object')
        if (type == 'boolean')
            schema = { '.type':'boolean' };
        else if (type == 'number')
            // specifying a Number leaf with an actual Number triggers normalization
            if (schema) // unless schema == 0
                schema = { '.type':'number', '.normal':schema };
            else
                schema = { '.type':'number' };
        else if (type == 'string') {
            // specifying a String leaf with an actual String triggers regex matching
            var rx = new RegExp (schema);
            schema = { '.type':'string', '.match':rx };
        } else if (type == 'array')
            // expect a specific sequence of schema
            schema = { '.type':'array', '.sequence':schema };
        else if (type == 'function')
            schema = { '.type':'function', '.function':schema };
        else if (type == 'regexp')
            schema = { '.type':'string', '.match':schema };
        else
            throw new Error ('unknown template type "'+type+'"');

    this.constraints = {};
    this.children = {};
    for (var key in schema) {
        if (key[0] == '.') {
            // special key
            if (!SPECIAL_KEYS.hasOwnProperty (key))
                continue; // ignore unknown specials

            var realKey = SPECIAL_KEYS[key];
            if (realKey == 'children') { // .children field
                this.constraints.type = 'object'; // only Objects have children
                var addChildren = schema[key];
                for (var child in addChildren)
                    if (this.children.hasOwnProperty (child))
                        throw new Error ('duplicate child at ' + path ? path + '.' + child : child);
                    else
                        this.children[child] = new Likeness (
                            addChildren[child],
                            path ? path + '.' + key : key
                        );
                continue;
            }

            if (this.constraints.hasOwnProperty (realKey))
                throw new Error ('duplicate constraint "'+key+'" at '+path);
            this.constraints[realKey] = schema[key];
            continue;
        }

        // child
        this.constraints.type = 'object'; // only Objects have children
        if (this.children.hasOwnProperty (key))
            throw new Error ('duplicate child at ' + path ? path + '.' + key : key);
        else {
            var newChild = new Likeness (
                schema[key],
                path ? path + '.' + key : key
            );
            if (newChild.isAsync)
                this.isAsync = true;
            this.children[key] = newChild;
        }
    }

    // if we have an async function somewhere, mark ourselves async
    if (this.constraints.async)
        this.isAsync = true;

    // convert special constriants to Likeness instances
    if (this.constraints.all) {
        this.constraints.all = new Likeness (
            this.constraints.all
        );
        if (this.constraints.all.isAsync)
            this.isAsync = true;
    }
    if (this.constraints.exists) {
        if (getTypeStr (this.constraints.exists) == 'array')
            for (var i in this.constraints.exists)
                this.constraints.exists[i] = new Likeness (
                    this.constraints.exists[i]
                );
        else
            this.constraints.exists = [ new Likeness (
                this.constraints.exists
            ) ];

        for (var i in this.constraints.exists)
            if (this.constraints.exists[i].isAsync)
                this.isAsync = true;
    }
    if (this.constraints.sequence)
        for (var i in this.constraints.sequence) {
            var newChild = new Likeness (
                this.constraints.sequence[i],
                this.path ? this.path + '.' + i : String(i)
            );
            if (newChild.isAsync)
                this.isAsync = true;
            this.constraints.sequence[i] = newChild;
        }
    if (this.constraints.keyTest) {
        var newChild = new Likeness (
            this.constraints.keyTest
        );
        if (newChild.isAsync)
            this.isAsync = true;
        this.constraints.keyTest = newChild;
    }
    if (this.constraints.drop) {
        var drop = {};
        for (var i in this.constraints.drop)
            drop[this.constraints.drop[i]] = true;
        this.constraints.drop = drop;
    }
};



Likeness.prototype.validate = require ('./lib/Validate');


Likeness.prototype.report = require ('./lib/Report');


Likeness.prototype.transform = require ('./lib/Transform');


Likeness.getTypeStr = getTypeStr;
module.exports = Likeness;
module.exports.errors = require ('./lib/errors');
// module.helpers = require ('./helpers');
