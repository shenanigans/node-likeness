
/**     @module/class likeness

@argument schema
@Boolean #isAsync
@Boolean #hasTransform
@Boolean #noTransform
    If True, this Likeness instance may not be used for transforms. Currently this exists entirely
    to
*/

var async = require ('async');
var Sorting = require ('./lib/Sorting');
var Validate = require ('./lib/Validate');
var Transform = require ('./lib/Transform');
var Accumulate = require ('./lib/Accumulate');
var getTypeStr = require ('./lib/GetTypeStr');

/**     @class Configuration

@String #title
    A non-functional constraint provided to support the JSON Schema specification.
@String #description
    A non-functional constraint provided to support the JSON Schema specification.
@Array[likeness] #anyOf
    Validate if any one of an Array of Likenesses validates. When transforming, the first Likeness
    to complete the transform successfully is used.
@Array[likeness] #oneOf
     * *synonyms:* `exactlyOne`

    Validate if one and **only** one of an Array of Likenesses validates. When transforming, every
    Likeness is applied. One and only one must complete successfully.
@likeness #not
    Validate if another Likeness does not. When transforming, the final value after all transforms
    have been applied must not be validated by this Likeness.
@String #type
    Restrict the document to a specific JSON type. Acceptable values are:
     * `"object"`
     * `"array"`
     * `"string"`
     * `"number"`
     * `"integer"`
@Boolean #adHoc
     * *applies to type:* `object`
     * *synonyms:* `arbitrary`

    Accept unknown key names when no validator for unknown keys can be found.
@Boolean #tolerant
     * *applies to type:* `object`

    When transforming, ignore unkown keys.
@Boolean #optional
     * *applies to type:* direct children of an `object`

    Whether this document is required to exist on the parent document.
@Boolean #unique
     * *applies to type:* `object`, `array`

    Does not validate if any children or elements of the document are duplicates. When transforming,
    the constraint is enforced but enforcement will not cause the transform to fail.
@Function #key
     * *applies to type:* `object`
     * *synonyms:* `keyTest`
@Object #children
    If a fixed child name begins with a period, this property is used to insulate it from the
    operator namespace.
@Object #matchChildren
     * *applies to type:* `object`

    Child Likenesses flexibly matched to keys by regular expressions. Child matches are executed in
    documented order. When transforming, the first matching regular expression is used.
@Number #min
     * *synonyms:* `minKeys`, `minVals`, `minValues`, `greaterOrEqual`, `gte`

    The minimum value, string length or child or element count for the document.
@Number #exclusiveMin
     * *applies to type:* `number`, `integer`
     * *synonyms:* `greaterThan`, `gt`

    Exclusive minimum value.
@Number #max
     * *synonyms:* `maxKeys`, `maxVals`, `maxValues`, `lessOrEqual`, `lte`

    The maximum value, string length or child or element count for the document.
@Number #exclusiveMax
     * *applies to type:* `number`, `integer`
     * *synonyms:* `lessThan`, `lt`

    Exclusive maximum value.
@Array #modulo
     * *applies to type:* `number`, `integer`
     * *synonyms:* `mod`

    Validates if the value modulo a given value is equal to another given value. Formatted as
    `[ divisor, remainder ]`.
@Number #multiple
     * *applies to type:* `number`, `integer`

    Validates if the remainder of division by the given value is exactly zero.
@Number #length
     * *applies to type:* `object`, `array`, `string`
     * *synonyms:* `len`, `keys`, `vals`, `values`

    Validates if the string length or child or element count is exactly equal to the given value.
@String|RegExp #match
     * *applies to type:* `string`
     * *synonyms:* `regex`, `regexp`

    Validates if the string matches the provided regular expression.
@Function #eval
    Simply test document values with a [Function]() call. If the [async](Configuration#async)
    constraint is configured, a callback will be passed to the evaluation function and the return
    value will be ignored.
    @argument document
    @callback
        @argument/Error err
            @optional
            Invalidates the document and packs this Error into the returned [ValidationError](
            likeness.ValidationError)
        @returns
    @returns isValid
        In synchronous validation mode, return a truthy value to validate the document.
@Boolean #async
    Indicate that all functional constraints on this Likeness are dedicated async Functions. Forces
    the entire ancestor chain to use asynchronous execution mode exclusively.
@Array[likeness] #exists
     * *applies to type:* `object`, `array`
     * *synonyms:* `thereExists`

    For each element in this constraint, at least one child or element of the document must
    validate. If the element likeness has a [times constraint](.Configuration#times), more than one
    validating child or element my be required to validate the `exists` constraint.
@likeness #all
     * *applies to type:* `object`, `array`
     * *synonyms:* `forAll`, `every`, `forEvery`

    Every child or element of the document my by validated by this Likeness.
@likess #extras
     * *applies to type:* `object`, `array`
     * *synonyms:* `extra`

    Children and elements not affected by any other constraint will be validated and transformed by
    this Likeness.
@member value
    Provide a document which all valid documents must replicate exactly.
@Array #anyValue
    Any Array of possible values. Validating documents must exactly match one of these values.
@Array[likeness] #sequence
     * *applies to type:* `array`

    Validations and transforms for each element of the document are handled by their sister elements
    in this constraint. If the sequence runs out of Likenesses before the document, validations and
    transforms will fail unless an [extras](.Coonfiguration#extras) constraint is available.
@Number|String #recurse
    Recursive reference, as either a Number of levels or unix-like backref String composed of any
    number of concatenated `"../"` sequences. Replaces the Likeness in this position with an
    ancestral likeness.
@Function #transform
    Manually transform the document with a Function. Affected by the [async property]
    (.Configuration#async).
    @argument document
    @callback
        @argument/Error|undefined err
            Reject the transform and pack this Error into the returned [ValidationError]
            (likeness.ValidationError)
        @argument newValue
            The transformed value, or `undefined` to drop the document from its parent (if any).
        @returns
    @returns newValue
        In synchronous transform mode, return the transformed value, or `undefined` to drop the
        document from its parent (if any).
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

var SPECIAL_KEYS = {
    //================================== Metadata
    //      Describe the schema document
    '.title':           'title',
    '.description':     'description',

    //================================== Meta-Validations
    //      Constrain by permutations of other schema
    //      Transforms by matching schema
    '.anyOf':           'anyOf',        // match first among an Array of schema
    '.or':              'anyOf',
    '.oneOf':           'oneOf',        // match exactly one among an Array of schema
    '.exactlyOne':      'oneOf',
    '.xor':             'oneOf',
    '.not':             'not',          // must not match schema

    //================================== Validations
    //      Constrain documents and incoming transforms
    '.type':            'type',         // restrict document type
    '.adHoc':           'adHoc',        // accept unknown keys
    '.arbitrary':       'adHoc',
    '.optional':        'optional',     // accept `undefined` as a valid document
    '.invalid':         'invalid',      // if traversed, always invalid
    '.dependencies':    'dependencies', // schema or name requirements triggered by key presence
    '.unique':          'unique',       // all children or array elements must be unique values
    '.key':             'keyTest',      // for matching arbitrary keys
    '.keyTest':         'keyTest',
    '.children':        'children',     // optional - this is the escape strategy for special keys
    '.child':           'children',
    '.matchChildren':   'matchChildren',   // children matched by regex rather than exact name
    '.matchChild':      'matchChildren',
    '.minKeys':         'minKeys',
    '.maxKeys':         'maxKeys',
    '.keyCount':        'keyCount',
    '.minVals':         'minVals',
    '.minValues':       'minVals',
    '.maxVals':         'maxVals',
    '.maxValues':       'maxVals',
    '.valCount':        'valCount',
    '.minLength':       'minLength',
    '.maxLength':       'maxLength',
    '.length':          'length',
    '.greaterThan':     'gt',
    '.gt':              'gt',
    '.greaterOrEqual':  'gte',
    '.gte':             'gte',
    '.lessThan':        'lt',
    '.lt':              'lt',
    '.lessOrEqual':     'lte',
    '.lte':             'lte',
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
    '.times':           'times',        // modifies `exists` constraint - requires [times] matches
    '.all':             'all',          // every key/value matches the given schema
    '.forAll':          'all',
    '.every':           'all',
    '.forEvery':        'all',
    '.extras':          'extras',       // keys or elements not covered by any other constraint
    '.extra':           'extras',
    '.value':           'value',        // exact value match
    '.anyValue':        'anyValue',     // exact value match against Array of candidates
    '.sequence':        'sequence',     // an Array of schema which must match sequentially
    '.sort':            'sort',
    '.recurse':         'recurse',      // recursive backref
    '.format':          'format',       // validate Strings as matching a complex web-rfc format
    '.keyFormat':       'keyFormat',    // accept keys matching a complex web-rfc format
};

var TRANSFORM_KEYS = {
    //================================== Transforms
    //      These don't evaluate documents, they transform valid documents
    '.tolerant':        'tolerant',     // ignore unknown keys
    '.cast':            'cast',         // convert strings to match .type
    '.set':             'setVal',       // hard overwrite
    '.default':         'default',      // fill if not defined
    '.inject':          'inject',       // insert hard data into input and overwrite target
    '.insert':          'insert',       // insert input into target at Array/String position
    '.newKeys':         'newKeys',      // ignore keys already found on the target
    '.append':          'append',       // append input to target Array/String
    '.prepend':         'prepend',      // prepend input to target Array/String
    '.asElem':          'asElem',
    '.asItem':          'asItem',
    '.normal':          'normal',       // normalize Numbers
    '.normalize':       'normal',
    '.normalization':   'normal',
    '.add':             'add',          // add input number to target
    '.total':           'add',
    '.subtract':        'subtract',     // subtract input number from target
    '.multiply':        'multiply',     // multiply target number by input
    '.divide':          'divide',       // divide target number by input
    '.average':         'average',      // add input to target and divide by 2.
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
    '.fill':            'fill',         // accumulate values from other paths, transform repeatedly
    '.list':            'list',         // accumulate values from other paths, create value array
    '.select':          'select'        // filter values by validating against a schema
};
for (var key in TRANSFORM_KEYS)
    SPECIAL_KEYS[key] = TRANSFORM_KEYS[key];


var Likeness = function (schema, path, parent) {
    if (!(this instanceof Likeness))
        return new Likeness (schema, path, parent);
    this.path = path;
    this.parent = parent;

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

            if (TRANSFORM_KEYS.hasOwnProperty (key))
                this.hasTransform = true;

            var realKey = SPECIAL_KEYS[key];
            if (realKey == 'children') { // .children field
                this.constraints.type = 'object'; // only Objects have children
                var addChildren = schema[key];
                for (var child in addChildren)
                    if (this.children.hasOwnProperty (child))
                        throw new Error ('duplicate child at ' + path ? path + '.' + child : child);
                    else {
                        this.children[child] = new Likeness (
                            addChildren[child],
                            path ? path + '.' + key : key,
                            this
                        );
                    }
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
                path ? path + '.' + key : key,
                this
            );
    }

    // if we have an async Function somewhere, mark ourselves async
    if (this.constraints.async)
        this.isAsync = true;

    // convert special constriants to Likeness instances
    var anyTransform, oneTransform;
    if (this.constraints.anyOf)
        for (var i=0,j=this.constraints.anyOf.length; i<j; i++) {
            this.constraints.anyOf[i] = new Likeness (this.constraints.anyOf[i], path, this);
            if (this.constraints.anyOf[i].hasTransform)
                anyTransform = true;
        }

    if (this.constraints.oneOf)
        for (var i=0,j=this.constraints.oneOf.length; i<j; i++) {
            this.constraints.oneOf[i] = new Likeness (this.constraints.oneOf[i], path, this);
            if (this.constraints.oneOf[i].hasTransform)
                oneTransform = true;
        }

    if (anyTransform && oneTransform)
        throw new Error ('cannot transform with .anyOf and .oneOf in the same schema');

    if (this.constraints.not)
        this.constraints.not = new Likeness (this.constraints.not, path, this);

    if (this.constraints.all)
        this.constraints.all = new Likeness (this.constraints.all, path, this);

    if (this.constraints.dependencies) {
        var depKeys = Object.keys (this.constraints.dependencies);
        if (depKeys.length && !(this.constraints.dependencies[depKeys[0]] instanceof Array))
            for (var i=0,j=depKeys.length; i<j; i++) {
                var newLikeness = this.constraints.dependencies[depKeys[i]] = new Likeness (
                    this.constraints.dependencies[depKeys[i]]
                );
                if (!newLikeness.constraints.type)
                    newLikeness.constraints.type = 'object';
                else if (newLikeness.constraints.type != 'object')
                    throw new Error (
                        'invalid dependency - set to type "'
                      + newLikeness.constraints.type
                      + '" (must be "object")'
                    );
                if (newLikeness.constraints.tolerant !== false)
                    newLikeness.constraints.tolerant  = true;
                if (newLikeness.constraints.adHoc !== false)
                    newLikeness.constraints.adHoc = true;
            }
    }

    if (this.constraints.extras)
        this.constraints.extras = new Likeness (this.constraints.extras, path, this);

    if (this.constraints.exists) {
        if (this.constraints.exists instanceof Array)
            for (var i in this.constraints.exists)
                this.constraints.exists[i] = new Likeness (this.constraints.exists[i], path, this);
        else
            this.constraints.exists = [ new Likeness (this.constraints.exists, path, this) ];
    }

    if (this.constraints.sequence)
        for (var i in this.constraints.sequence)
            this.constraints.sequence[i] = new Likeness (
                this.constraints.sequence[i],
                this.path ? this.path + '.' + i : String(i),
                this
            );

    if (this.constraints.keyTest)
        this.constraints.keyTest = new Likeness (
            this.constraints.keyTest,
            path,
            this
        );

    if (this.constraints.drop) {
        var drop = {};
        for (var i in this.constraints.drop)
            drop[this.constraints.drop[i]] = true;
        this.constraints.drop = drop;
    }

    if (this.constraints.match)
        this.constraints.match = new RegExp (this.constraints.match);

    if (this.constraints.matchChildren) {
        var newMatchers = [];
        for (var pattern in this.constraints.matchChildren) {
            var subschema = new Likeness (this.constraints.matchChildren[pattern], path, this);
            subschema.pattern = new RegExp (pattern);
            newMatchers.push (subschema);

            // match against named children and merge if necessary
            for (var name in this.children)
                if (subschema.pattern.test (name))
                    this.children[name] = this.children[name].createChild (subschema);
        }
        this.constraints.matchChildren = newMatchers;
    }

    if (this.constraints.recurse) {
        var depth;
        if (typeof this.constraints.recurse == 'string')
            depth = this.constraints.recurse.split ('../').length - 1;
        else
            depth = this.constraints.recurse;

        var pointer = this;
        for (var i=0; i<depth; i++) {
            pointer = pointer.parent;
            if (!pointer)
                throw new Error ('unable to recurse - too deep');
        }
        this.constraints.recurse = pointer;
    }

    if (this.constraints.sort) {
        if (typeof this.constraints.sort == 'number')
            this.constraints.sort = Sorting.getLeafsort (this.constraints.sort);
        else
            this.constraints.sort = Sorting.getDocsort (this.constraints.sort);
    }

    if (this.constraints.fill)
        if (typeof this.constraints.fill == 'string')
            this.constraints.fill = [ this.constraints.fill ];
        else if (!(this.constraints.fill instanceof Array))
            this.constraints.fill = [ new Likeness (this.constraints.fill, this.path, this) ];
        else for (var i=0,j=this.constraints.fill.length; i<j; i++)
            if (typeof this.constraints.fill[i] != 'string')
                this.constraints.fill[i] = new Likeness (this.constraints.fill[i], this.path, this);

    if (this.constraints.list)
        if (typeof this.constraints.list == 'string')
            this.constraints.list = [ this.constraints.list ];
        else if (!(this.constraints.list instanceof Array))
            this.constraints.list = [ new Likeness (this.constraints.list, this.path, this) ];
        else for (var i=0,j=this.constraints.list.length; i<j; i++)
            if (typeof this.constraints.list[i] != 'string')
                this.constraints.list[i] = new Likeness (this.constraints.list[i], this.path, this);

    // constraint constraints
    // cases that define an invalid schema
    if (this.constraints.cast) {
        if (!this.constraints.type)
            throw new Error ('cannot use .cast without .type');
        if (this.constraints.type instanceof Array)
            throw new Error ('cannot use .case with an ambiguous .type');
    }

    if (this.constraints.sequence) {
        if (this.constraints.append)
            throw new Error ('cannot use .sequence with .append');
        if (this.constraints.prepend)
            throw new Error ('cannot use .sequence with .prepend');
        if (this.constraints.insert)
            throw new Error ('cannot use .sequence with .insert');
    }

    // propogate flag booleans upward
    if (parent) {
        if (this.isAsync)
            parent.isAsync = true;
    }
};


/**     @member/Function export
    Create a JSON representation of this schema, with several caveats which may distinguish it from
    the schema used to instantiate this Likeness. These are:
     * all special key names are converted from synonyms to canonical names (e.g. `.child` becomes
        `.children`)
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

Likeness.prototype.validate = Validate;
Likeness.prototype.transform = Transform;
Likeness.prototype.accumulate = Accumulate;


/**     @property/Function Validator
    Return a Function that simply validates on a schema, as fast as possible, returning a Boolean.
    If the schema is asynchronous, a callback Function is expected. Synchronous schemata do *not*
    honor callbacks.
@returns/Function
*/
function Validator (schema) {
    var like = new Likeness (schema);
    return function (doc, callback) {
        if (callback && this.isAsync) {
            like.validate (doc, function (err) {
                callback (!Boolean (err));
            });
            return;
        }
        try {
            like.validate (doc);
            return true;
        } catch (err) {
            return false;
        }
    };
}
Likeness.Validator = Validator;

Likeness.getTypeStr = getTypeStr;
module.exports = Likeness;
Likeness.errors = require ('./lib/errors');
Likeness.helpers = require ('./helpers');

Likeness.util = {
    validateFormat:     require ('./lib/Format').validate,
    TypeValidators:     require ('./lib/TypeValidators'),
    TypeTransformers:   require ('./lib/TypeTransformers'),
};
