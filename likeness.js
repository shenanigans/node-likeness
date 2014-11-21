
/**     @module/class likeness

@argument schema
*/

var async = require ('async');

/**     @class ValidationError
    Reporting format for validation failures. Not, in fact, a subclass of Error.
@member/String error
    A String code from a handful of select values:
     * `missing` A key was missing, or a `.exists` constraint failed.
     * `type` Specific to the `.type` constraint.
     * `limit` Failues of `.min` and `.max` constraints.
     * `format` Failures of `.length`, `.value`, `.match`, `sequence`, and `.all`.
     * `illegal` Unexpected extra keys, keys rejected by `.key`.
     * `sync` An asynchronous `.eval` constraint could not be processed.
     * `transform` An error which occured during a [transform](#transform) call.
@member/String msg
@member constraint
@member value
@member/.ValidationError source
    If the source document fails validation during a [transform](#transform) call, the relevant
    [ValidationError](.ValidationError) will be provided here.
*/

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

/**     @property/Function getTypeStr
    Get a useful type string for various javascript types.
*/
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

var SPECIAL_KEYS = {
    '.type':            'type',
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
    '.key':             'keyTest',      // for matching arbitrary keys
    '.keyTest':         'keyTest',
    '.optional':        'optional',     // accept `undefined` as a valid document
    '.optional':        'optional',
    '.optional':        'optional',
    '.adHoc':           'adHoc',
    '.arbitrary':       'adHoc',
    '.children':        'children',     // optional - this is the escape strategy for special keys
    '.child':           'children',
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
    '.unit':            'doNotBreak',   // disqualifies a schema node from #transform(partial
    //============================= Transforms!
    //      These don't evaluate documents, they transform valid documents
    '.set':             'setVal',       // hard overwrite
    '.insert':          'insert',       // insert
    '.insertAt':        'arrInsert',    // Array insert - [ [ i, val ], ...]
    '.append':          'arrAppend',    // append to Array
    '.prepend':         'arrPrepend',   // prepend to Array
    '.normal':          'normal',       // normalize Numbers
    '.normalize':       'normal',
    '.normalization':   'normal',
    '.split':           'split',        // regex split
    '.group':           'group',        // regex exec -> Array of groups
    '.transform':       'transform',
    '.function':        'transform',
    '.filter':          'filter',       // pass key/index and value to function for selective drop
    '.rename':          'rename',       // rename a key
    '.drop':            'drop'          // drop a key
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
        else
            this.children[key] = new Likeness (
                schema[key],
                path ? path + '.' + key : key
            );
    }

    // convert special constriants to Likeness instances
    if (this.constraints.all)
        this.constraints.all = new Likeness (
            this.constraints.all,
            this.path ? this.path + '.*' : '*'
        );
    if (this.constraints.exists)
        if (getTypeStr (this.constraints.exists) == 'array')
            for (var i in this.constraints.exists)
                this.constraints.exists[i] = new Likeness (
                    this.constraints.exists[i],
                    this.path ? this.path + '.*' : '*'
                );
        else
            this.constraints.exists = [ new Likeness (
                this.constraints.exists,
                this.path ? this.path + '.*' : '*'
            ) ];
    if (this.constraints.sequence)
        for (var i in this.constraints.sequence)
            this.constraints.sequence[i] = new Likeness (
                this.constraints.sequence[i],
                this.path ? this.path + '.'+i : String(i)
            );
    if (this.constraints.keyTest)
        this.constraints.keyTest = new Likeness (
            this.constraints.keyTest,
            this.path ? this.path + '.___KEYS___' : '___KEYS___'
        );
};



Likeness.prototype.validate = require ('./lib/Validate');


Likeness.prototype.report = require ('./lib/Report');


Likeness.prototype.transform = require ('./lib/Transform');


Likeness.getTypeStr = getTypeStr;
module.exports = Likeness;
// module.helpers = require ('./helpers');
