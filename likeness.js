
/**     @module|class likeness

@argument/.Configuration|Object|Array|String|Number|Boolean schema
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


var async = require ('async');

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
    '.modulo':             'modulo',    // modulo
    '.length':          'length',       // exact length match
    '.len':             'length',
    '.keys':            'length',
    '.vals':            'length',
    '.values':          'length',
    '.key':             'keyTest',      // for matching arbitrary keys
    '.optional':        'optional',     // accept `undefined` as a valid document
    '.optional':        'optional',
    '.optional':        'optional',
    '.adHoc':           'adHoc',
    '.arbitrary':       'adHoc',
    '.children':        'children',     // optional - this is the escape strategy for special keys
    '.child':           'children',
    '.match':           'match',        // regex value matching (only available for .type="string")
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
    '.normal':          'normal',
    '.normalize':       'normal',
    '.normalization':   'normal',
    '.regex':           'regexTransform',
    '.regexTransform':  'regexTransform',
    '.transform':       'transform',
    '.function':        'transform'
};

var TYPE_VALIDATORS = {
    object:     function (value, callback) {
        var keys = Object.keys (value);
        var len = keys.length;
        var remaining = {};
        for (var key in this.children)
            remaining[key] = true;

        // minKeys
        if (this.constraints.min !== undefined && len < this.constraints.min) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        // maxKeys
        if (this.constraints.max !== undefined && len > this.constraints.max) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        // clone .exists, so we can sweep it as we go
        var exists = [];
        var existsLives = [];
        for (var i in this.constraints.exists) {
            exists.push (this.constraints.exists[i]);
            existsLives.push (this.constraints.exists[i].constraints.times || 1);
        }

        // children - async
        if (callback) {
            var self = this;
            var NOT_VALID = {}; // just a token to pass errors to the callback
            return async.each (Object.keys (value), function (name, callback) {
                delete remaining[name];

                // finalization function
                function postValidate (err, isValid) {
                    // manage .exists and .all commitments, pass the callback
                    if (err) return callback (err);
                    if (!isValid) return callback (NOT_VALID);
                    if (exists.length) { // process .exists constraints
                        return async.each (Object.keys (exists), function (i, callback) {
                            exists[i].validate (value, function (err, isValid) {
                                if (err) return callback (err);
                                if (isValid && !--existsLives[i]) {
                                    // we're guaranteed that `async` fired everything by now
                                    // so it's safe to edit these
                                    exists.splice (i, 1);
                                    existsLives.splice (i, 1);
                                }
                            });
                        }, function (err) {
                            if (err) return callback (err);

                            if (!self.constraints.all)
                                return callback();
                            self.constraints.all.validate (value, function (err, isValid) {
                                if (err) return callback (err);
                                if (!isValid) return callback (NOT_VALID);
                                return callback();
                            });
                        });
                    }

                    // no .exists constraints
                    if (!self.constraints.all)
                        return callback ();
                    self.constraints.all.validate (value, function (err, isValid) {
                        if (err) return callback (err);
                        if (!isValid) return callback (NOT_VALID);
                        return callback();
                    });
                }

                if (Object.hasOwnProperty.call (self.children, name))
                    return self.children[name].validate (value[name], postValidate);
                else {
                    // unknown key
                    if (self.constraints.keyTest)
                        return self.constraints.keyTest.validate (name, postValidate)
                    if (self.constraints.adHoc)
                        return process.nextTick (function(){ postValidate (undefined, true); });
                    return callback (NOT_VALID);
                }
            }, function (err) {
                if (err)
                    return callback (err === NOT_VALID ? undefined : err, false);
                if (exists.length) // unresolved .exists
                    return callback (undefined, false);

                var leftovers = Object.keys (remaining);
                if (!leftovers.length)
                    return callback (undefined, true);

                // we can do this test synchronously
                for (var i in leftovers)
                    if (!self.children[leftovers[i]].constraints.optional)
                        return callback (undefined, false);
                return callback (undefined, true);
            });
        }

        // children - sync
        for (var name in value) {
            delete remaining[name];
            if (!Object.hasOwnProperty.call (this.children, name)) {
                // unknown key
                if (this.constraints.keyTest) {
                    return this.constraints.keyTest.validate (name, postValidate)
                } else if (!this.constraints.adHoc)
                    return false;
            } else if (!this.children[name].validate (value[name]))
                return false;

            // .exists
            for (var i=0,j=exists.length; i<j; i++)
                if (exists[i].validate (value[name]) && !--existsLives[i]) {
                    exists.splice (i, 1);
                    existsLives.splice (i, 1);
                    i--; j--;
                }

            // .all
            if (this.constraints.all && !this.constraints.all.validate (value))
                return false;
        }
        // unresolved .exists
        if (exists.length)
            return false;
        // missing keys?
        var leftovers = Object.keys (remaining);
        if (!leftovers.length)
            return true;
        for (var i in leftovers)
            if (!this.children[leftovers[i]].constraints.optional)
                return false;
        return true;
    },
    array:      function (value, callback) {
        var len = value.length;

        // minVals
        if (this.constraints.min !== undefined && len < this.constraints.min) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        // maxVals
        if (this.constraints.max !== undefined && len > this.constraints.max) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        if (callback) return process.nextTick (function(){ callback (undefined, true); });
        return true;
    },
    string:     function (value, callback) {
        var len = value.length;

        // minVals
        if (this.constraints.min !== undefined && len < this.constraints.min) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        // maxVals
        if (this.constraints.max !== undefined && len > this.constraints.max) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        // regex matching
        if (this.constraints.match !== undefined && !this.constraints.match.test (value)) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        if (callback) return process.nextTick (function(){ callback (undefined, true); });
        return true;
    },
    number:     function (value, callback) {
        // min
        if (this.constraints.min !== undefined && value < this.constraints.min) {
            if (callback) return process.nextTick (callback);
            return false;
        }
        // exclusiveMin
        if (this.constraints.exclusiveMin !== undefined && value <= this.constraints.exclusiveMin) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        // max
        if (this.constraints.max !== undefined && value > this.constraints.max) {
            if (callback) return process.nextTick (callback);
            return false;
        }
        // exclusiveMax
        if (this.constraints.exclusiveMax !== undefined && value >= this.constraints.exclusiveMax) {
            if (callback) return process.nextTick (callback);
            return false;
        }

        // modulo
        if (this.constraints.modulo !== undefined) {
            try {
                var divisor = this.constraints.modulo[0];
                var remainder = this.constraints.modulo[1];
                if (value % divisor == remainder)
                    if (callback)
                        return process.nextTick (function(){ callback (undefined, true); });
                    else
                        return true;
                else
                    if (callback)
                        return process.nextTick (callback);
                    else
                        return false;
            } catch (err) {
                return callback (new Error ('invalid .modulo restraint'));
            }
            if (callback) return process.nextTick (callback);
            return false;
        }

        if (callback) return process.nextTick (function(){ callback (undefined, true); });
        return true;
    },
    boolean:    function (value, callback) {
        if (callback) return process.nextTick (function(){ callback (undefined, true); });
        return true;
    }
};

var TYPE_TRANSFORMERS = {
    object:     function (value, target, key, callback) {

    },
    array:      function (value, target, key, callback) {

    },
    string:     function (value, target, key, callback) {

    },
    number:     function (value, target, key, callback) {

    },
    boolean:    function (value, target, key, callback) {

    }
};

var Likeness = function (schema, path) {
    // convert any nodes which are not of Configuration type to their Configuration representations
    var type = getTypeStr (schema);
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
    else if (type != 'object')
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
                var addChildren = schema[key];
                for (var child in addChildren)
                    if (this.children.hasOwnProperty (child))
                        throw new Error ('duplicate child at '+path);
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
            throw new Error ('duplicate child at '+path);
        else
            this.children[key] = new Likeness (
                schema[key],
                path ? path + '.' + key : key
            );
    }

    // convert special constriants to Likeness instances
    if (this.constraints.all)
        this.constraints.all = new Likeness (this.constraints.all);
    if (this.constraints.exists)
        if (getTypeStr (this.constraints.exists) == 'array')
            for (var i in this.constraints.exists)
                this.constraints.exists[i] = new Likeness (this.constraints.exists[i]);
        else
            this.constraints.exists = [ new Likeness (this.constraints.exists) ];
    if (this.constraints.sequence)
        for (var i in this.constraints.sequence)
            this.constraints.sequence[i] = new Likeness (this.constraints.sequence[i]);
    if (this.constraints.keyTest)
        this.constraints.keyTest = new Likeness (this.constraints.keyTest);
};


/**     @member/Function validate
    Determine whether the provided document meets the configured restraints.
@argument/Object|Array|String|Number|undefined value
@callback
    @optional
    If present, the callback will always be honored. However, it is only necessary if this
    `likeness` has an asynchronous validation operation.
    @argument/Error|undefined err
    @argument/Boolean|undefined isValid
*/
Likeness.prototype.validate = function (value, callback) {
    var self = this;

    if (value === undefined) {
        if (this.constraints.optional) {
            // optional value is missing, validates ok
            if (callback) return process.nextTick (function(){ callback (undefined, true); });
            return true;
        }
        if (callback) return process.nextTick (callback);
        return false;
    }

    var valtype = getTypeStr (value);
    if (this.constraints.type !== undefined && valtype != this.constraints.type) {
        if (callback) return process.nextTick (callback);
        return false;
    }
    if (!TYPE_VALIDATORS.hasOwnProperty (valtype))
        if (callback)
            return process.nextTick (function(){ callback (new Error ('unknown type '+valtype)); });
        else
            throw new Error ('unknown type '+valtype);

    var validator = TYPE_VALIDATORS[valtype];
    // async
    if (callback) {
        if (!validator.call (this, value))
            return process.nextTick (callback);
        if (!this.constraints.eval)
            return process.nextTick (function(){ callback (undefined, true); });
        if (this.constraints.async)
            return this.constraints.eval (value, callback);
        if (!this.constraints.eval (value))
            return process.nextTick (callback);

        return process.nextTick (function(){ callback (undefined, true); });
    }

    // sync
    if (!validator.call (this, value)) return false;
    if (this.constraints.eval)
        if (this.constraints.async)
            return false;
        else
            return this.constraints.eval (value);
    return true;
};

/**     @member/Function transform
    Confirm that the provided document meets the configured restraints and construct a second clone
    document modified by the configured transforms.
@argument/Object|Array|String|Number|undefined value
@argument/Object|Array target
    @optional
    If a secondary `target` option is provided, `value` is not changed. Validated and transformed
    values are safely cloned into `target`. A type mismatch is an instant validation failure.
@callback
    @optional
    If present, the callback will always be honored. However, it is only necessary if this
    `likeness` has an asynchronous transform operation.
*/
Likeness.prototype.transform = function (value, target, callback) {

};

Likeness.getTypeStr = getTypeStr;
module.exports = Likeness;
module.helpers = require ('./helpers');
