
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
    //================================== Metadata
    //      Describe the schema document
    '.title':           'title',
    '.description':     'description',

    //================================== Meta-Validations
    //      Constrain by permutations of other schema
    //      Transforms by matching schema
    '.anyOf':           'anyOf',        // match first among an Array of schema
    '.oneOf':           'oneOf',        // match exactly one among an Array of schema
    '.exactlyOne':      'oneOf',
    '.not':             'not',          // must not match schema

    //================================== Validations
    //      Constrain documents and incoming transforms
    '.type':            'type',         // restrict document type
    '.adHoc':           'adHoc',        // accept unknown keys
    '.arbitrary':       'adHoc',
    '.tolerant':        'tolerant',     // ignore unknown keys
    '.optional':        'optional',     // accept `undefined` as a valid document
    '.unique':          'unique',       // all children or array elements must be unique values
    '.key':             'keyTest',      // for matching arbitrary keys
    '.keyTest':         'keyTest',
    '.children':        'children',     // optional - this is the escape strategy for special keys
    '.child':           'children',
    '.matchChildren':   'matchChildren',   // children matched by regex rather than exact name
    '.matchChild':      'matchChildren',
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
    '.multiple':        'multiple',     // multiple of a value
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
    '.extras':          'extras',       // keys or elements not covered by any other constraint
    '.extra':           'extras',
    '.value':           'value',        // exact value match
    '.anyValue':        'anyValue',     // exact value match against Array of candidates
    '.sequence':        'sequence',     // an Array of schema which must match sequentially
    '.recurse':         'recurse',      // recursively backref an ancestral schema

    //================================== Transforms
    //      These don't evaluate documents, they transform valid documents
    '.cast':            'cast',         // convert strings to match .type
    '.set':             'setVal',       // hard overwrite
    '.default':         'default',      // fill if not defined
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

    // if we have an async Function somewhere, mark ourselves async
    if (this.constraints.async)
        this.isAsync = true;

    // convert special constriants to Likeness instances
    if (this.constraints.anyOf)
        for (var i in this.constraints.anyOf) {
            this.constraints.anyOf[i] = new Likeness (this.constraints.anyOf[i]);
            if (this.constraints.anyOf[i].isAsync)
                this.isAsync = true;
        }

    if (this.constraints.oneOf)
        for (var i in this.constraints.oneOf) {
            this.constraints.oneOf[i] = new Likeness (this.constraints.oneOf[i]);
            if (this.constraints.oneOf[i].isAsync)
                this.isAsync = true;
        }

    if (this.constraints.not) {
        this.constraints.not = new Likeness (this.constraints.not);
        if (this.constraints.not.isAsync)
            this.isAsync = true;
    }

    if (this.constraints.all) {
        this.constraints.all = new Likeness (this.constraints.all);
        if (this.constraints.all.isAsync)
            this.isAsync = true;
    }

    if (this.constraints.extras) {
        this.constraints.extras = new Likeness (this.constraints.extras);
        if (this.constraints.extras.isAsync)
            this.isAsync = true;
    }

    if (this.constraints.exists) {
        if (getTypeStr (this.constraints.exists) == 'array')
            for (var i in this.constraints.exists) {
                this.constraints.exists[i] = new Likeness (this.constraints.exists[i]);
                if (this.constraints.exists[i].isAsync)
                    this.isAsync = true;
            }
        else {
            this.constraints.exists = [ new Likeness (this.constraints.exists) ];
            if (this.constraints.exists[0].isAsync)
                this.isAsync = true;
        }
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

    if (this.constraints.matchChildren) {
        var newMatchers = [];
        for (var pattern in this.constraints.matchChildren) {
            var subschema = new Likeness (this.constraints.matchChildren[pattern]);
            subschema.pattern = new RegExp (pattern);
            if (subschema.isAsync)
                this.isAsync = true;
            newMatchers.push (subschema);
        }
        this.constraints.matchChildren = newMatchers;
    }
};


/**     @member/Function export
    Create a JSON representation of this schema, with several caveats which may distinguish it from
    the schema used to instantiate this Likeness. These are:
     * all special key names are converted from synonyms to canonical names (e.g. `.child` becomes
        `.children` )
     * the `.children` key is **only** used if a child key begins with a period.
@returns/Object
    A canonical JSON representation of this schema.
*/
Likeness.prototype.export = function(){
    var output = {};
    for (var key in this.constraints) {
        var constraint = this.constraints[key];
        if (constraint instanceof Likeness)
            output['.'+key] = constraint.export();
        else
            output['.'+key] = constraint;
    }

    var childKeys = Object.keys (this.children);
    if (!childKeys.length)
        return output;

    // do we need to use a .children property?
    var needsChildBlock = false;
    for (var i=0,j=childKeys.length; i<j; i++)
        if (childKeys[i] && childKeys[i][0] == '.') {
            needsChildBlock = true;
            break;
        }

    if (!needsChildBlock) {
        for (var i=0,j=childKeys.length; i<j; i++) {
            var key = childKeys[i];
            output[key] = this.children[key].export();
        }
        return output;
    }

    var children = output['.children'] = {};
    for (var i=0,j=childKeys.length; i<j; i++) {
        var key = childKeys[i];
        children[key] = this.children[key].export();
    }
    return output;
};


Likeness.prototype.validate = require ('./lib/Validate');


Likeness.prototype.report = require ('./lib/Report');


Likeness.prototype.transform = require ('./lib/Transform');


Likeness.getTypeStr = getTypeStr;
module.exports = Likeness;
module.exports.errors = require ('./lib/errors');
module.exports.helpers = require ('./helpers');
