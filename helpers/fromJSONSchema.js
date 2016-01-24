
var url = require ('url');
var async = require ('async');
var merge = require ('./mergeJSONSchema');

/**     @module likeness */
var SIMPLE_CONVERSIONS = {
    'title':                '.title',
    'description':          '.description',
    'error':                '.error',
    'type':                 '.type',
    'enum':                 '.anyValue',
    'multipleOf':           '.multiple',
    'divisibleBy':          '.multiple',
    'maximum':              '.lte',
    'maxLength':            '.maxLength',
    'maxItems':             '.maxVals',
    'maxProperties':        '.maxKeys',
    'minimum':              '.gte',
    'minLength':            '.minLength',
    'minItems':             '.minVals',
    'minProperties':        '.minKeys',
    'uniqueItems':          '.unique',
    'uniqueProperties':     '.unique',
    'pattern':              '.match',
    'modulo':               '.modulo',
    'length':               '.length',
    'numProperties':        '.keyCount',
    'numItems':             '.valCount',
    'match':                '.match',
    'times':                '.times',
    'tolerant':             '.tolerant',
    'cast':                 '.cast',
    'set':                  '.setVal',
    'default':              '.default',
    'insert':               '.insert',
    'inject':               '.inject',
    'append':               '.append',
    'prepend':              '.prepend',
    'normalize':            '.normal',
    'asItem':               '.asItem',
    'add':                  '.add',
    'subtract':             '.subtract',
    'multiply':             '.multiply',
    'divide':               '.divide',
    'average':              '.average',
    'modulate':             '.modFilter',
    'invert':               '.inverse',
    'reciprocal':           '.reciprocal',
    'total':                '.total',
    'mean':                 '.mean',
    'case':                 '.case',
    'rename':               '.rename',
    'drop':                 '.drop',
    'clip':                 '.clip',
    'getYear':              '.getYear',
    'getYearName':          '.getYearName',
    'getMonth':             '.getMonth',
    'getMonthName':         '.getMonthName',
    'getDay':               '.getDay',
    'getDayNum':            '.getDayNum',
    'getDayName':           '.getDayName',
    'sort':                 '.sort',
    'invalid':              '.invalid'
};

var SCHEMA_CONVERSIONS = {
    'additionalItems':      '.extras',
    'not':                  '.not',
    'forAll':               '.all',
    'equals':               '.value',
    'keyFormat':            '.keyFormat',
    'group':                '.group',
    'groupTransform':       '.groupTransform',
    'filter':               '.filter'
};

var MAP_CONVERSIONS = {
    'properties':           '.children',
    'patternProperties':    '.matchChildren'
};

var ARR_CONVERSIONS = {
    'allOf':                '.and',
    'anyOf':                '.anyOf',
    'oneOf':                '.oneOf',
    'thereExists':          '.exists'
};

var SKIP_STEPS = { };
for (var key in MAP_CONVERSIONS) SKIP_STEPS[key] = true;
for (var key in ARR_CONVERSIONS) SKIP_STEPS[key] = true;


/**     @property/Function fromJSONSchema
    Convert a JSON Schema spec to a likeness schema object. Creates an Object, not a Likeness
    instance. Will only process $ref statements that target a parent to the path of the $ref
    statement.
@argument/Object metaschema
    The $meta schema for the document to be converted.
@argument/Object schema
    JSON Schema document to convert.
@callback
    @argument/Error|undefined err
    @argument/Object compiled
    @returns
@argument/String path
    @optional
    @development
    Passed when recursing. The path traversed up to this point. Passed around entirely to support
    $ref and `.recurse`.
*/
function fromJSONSchema (metaschema, schema, callback, path) {
    var output = { '.adHoc':true };
    if (path) output['.optional'] = true;
    else path = '#';

    var keys = Object.keys (schema);
    var exMax = false;
    var exMin = false;
    async.each (keys, function (key, callback) {
        var subschema = schema[key];

        if (Object.hasOwnProperty.call (SIMPLE_CONVERSIONS, key)) {
            output[SIMPLE_CONVERSIONS[key]] = subschema;
            return callback();
        }

        if (Object.hasOwnProperty.call (SCHEMA_CONVERSIONS, key)) {
            // is this actually a simple key?
            if (typeof subschema != 'object') {
                output[SCHEMA_CONVERSIONS[key]] = subschema;
                return callback();
            }
            return fromJSONSchema (metaschema, subschema, function (err, sublikeness) {
                if (err) return callback (err);
                output[SCHEMA_CONVERSIONS[key]] = sublikeness;
                callback();
            }, path);
        }

        if (Object.hasOwnProperty.call (MAP_CONVERSIONS, key)) {
            var converted = {};
            return async.each (Object.keys (subschema), function (subkey, callback) {
                var subsubschema = subschema[subkey];
                if (typeof subsubschema != 'object') {
                    converted[subkey] = subsubschema;
                    return callback();
                }
                fromJSONSchema (metaschema, subschema[subkey], function (err, sublikeness) {
                    if (err) return callback (err);
                    converted[subkey] = sublikeness;
                    callback();
                }, path+'/'+key+'/'+subkey);
            }, function (err) {
                if (err) return callback (err);
                output[MAP_CONVERSIONS[key]] = converted;
                callback();
            });
        }

        if (Object.hasOwnProperty.call (ARR_CONVERSIONS, key)) {
            var converted = [];
            return async.times (subschema.length, function (subI, callback) {
                fromJSONSchema (metaschema, subschema[subI], function (err, sublikeness) {
                    if (err) return callback (err);
                    converted[subI] = sublikeness;
                    callback();
                }, path);
            }, function (err) {
                if (err) return callback (err);
                output[ARR_CONVERSIONS[key]] = converted;
                callback();
            });
        }

        if (key == 'items') {
            // array of schema -> .sequence
            if (subschema instanceof Array) {
                var converted = [];
                return async.times (subschema.length, function (subI, callback) {
                    fromJSONSchema (metaschema, subschema[subI], function (err, sublikeness) {
                        if (err) return callback (err);
                        converted[subI] = sublikeness;
                        callback();
                    }, path + '/items');
                }, function (err) {
                    if (err) return callback (err);
                    output['.sequence'] = converted;
                    callback();
                });
            }

            // single schema -> .all
            return fromJSONSchema (metaschema, subschema, function (err, sublikeness) {
                if (err) return callback (err);
                output['.all'] = sublikeness;
                callback();
            }, path + '/items');
        }

        if (key == '$ref') {
            // reference to another schema
            var info = url.parse (subschema);
            if (path.slice (0, info.hash.length) != info.hash)
                throw new Error ('non-recursive reference detected ('+path+' -> '+subschema+')');

            var middlePath = path.replace (info.hash, '').split ('/');
            for (var i=0, j=middlePath.length; i<j; i++) {
                var step = middlePath[i];
                if (!step || Object.hasOwnProperty.call (SKIP_STEPS, step)) {
                    middlePath.splice (i, 1);
                    i--; j--;
                }
            }
            output['.recurse'] = middlePath.length;
            return callback();
        }

        if (key == 'exclusiveMaximum')
            exMax = true;

        if (key == 'exclusiveMinimum')
            exMin = true;

        if (key == 'additionalProperties') {
            if (typeof subschema == 'boolean') {
                if (!subschema)
                    output['.adHoc'] = false;
                else
                    output['.adHoc'] = true;
                return callback();
            } else
                return fromJSONSchema (metaschema, subschema, function (err, sublikeness) {
                    if (err) return callback (err);
                    output['.extras'] = sublikeness;
                    callback();
                }, path);
        }

        if (key == 'dependencies') {
            var keys = Object.keys (subschema);
            if (!keys.length)
                return callback();
            if (subschema[keys[0]] instanceof Array) {
                output['.dependencies'] = subschema;
                return callback();
            }

            // it's a map of keys to subchemata
            var converted = {};
            return async.each (keys, function (subkey, callback) {
                fromJSONSchema (metaschema, subschema[subkey], function (err, sublikeness) {
                    if (err) return callback (err);
                    converted[subkey] = sublikeness;
                    callback();
                }, path+'/'+key+'/'+subkey);
            }, function (err) {
                if (err) return callback (err);
                output['.dependencies'] = converted;
                callback();
            });
        }

        if (key == 'fill' || key == 'list') {
            key = '.'+key;
            if (typeof subschema == 'string') {
                output[key] = subschema;
                return callback();
            }
            if (!(subschema instanceof Array))
                return fromJSONSchema (metaschema, subschema, function (err, subsublikeness) {
                    if (err) return callback (err);
                    output[key] = (subsublikeness);
                    callback();
                }, path);

            output[key] = [];
            async.times (subschema.length, function (subsubschemaI, callback) {
                var subsubschema = subschema[subsubschemaI];
                if (typeof subsubschema == 'string') {
                    output[key][subsubschemaI] = subsubschema;
                    return callback();
                }
                fromJSONSchema (metaschema, subschema, function (err, subsublikeness) {
                    if (err) return callback (err);
                    output[key][subsubschemaI] = subsublikeness;
                    callback();
                }, path);
            }, callback);
            return;
        }

        callback();
    }, function (err) {
        if (err) return callback (err);

        // post-process regex properties
        if (output['.matchChildren'] && output['.children']) {
            for (var pattern in output['.matchChildren']) {
                var patternSubschema = output['.matchChildren'][pattern];
                pattern = new RegExp (pattern);
                for (var childName in output['.children'])
                    if (pattern.test (childName))
                        patternSubschema = merge ( patternSubschema, output['.children'][childName]);
            }
        }

        // exclusive minimum and maximum
        if (exMin)
            if (output['.gte'] === undefined)
                return callback (new Error ('specified exclusiveMinimum but no minimum'));
            else {
                output['.gt'] = output['.gte'];
                delete output['.gte'];
            }
        if (exMax)
            if (output['.lte'] === undefined)
                return callback (new Error ('specified exclusiveMaximum but no maximum'));
            else {
                output['.lt'] = output['.lte'];
                delete output['.lte'];
            }

        // required / optional
        if (Object.hasOwnProperty.call (schema, 'required')) {
            if (typeof schema.required == 'boolean')
                if (schema.required)
                    delete output['.optional'];
                else
                    output['.optional'] = true;
            else {
                // mark props as non-optional
                for (var i=0,j=schema.required.length; i<j; i++) {
                    var key = schema.required[i];
                    if (Object.hasOwnProperty.call (output, key)) {
                        output[key]['.optional'] = false;
                        continue;
                    }
                    if (output['.children'] && Object.hasOwnProperty.call (output['.children'], key))
                        output['.children'][key]['.optional'] = false;
                }
            }
        }

        // type:"any"
        if (schema.type == 'any')
            delete output['.type'];
        callback (undefined, output);
    });
}

module.exports = fromJSONSchema;
module.exports.SIMPLE_CONVERSIONS   = SIMPLE_CONVERSIONS;
module.exports.SCHEMA_CONVERSIONS   = SCHEMA_CONVERSIONS;
module.exports.MAP_CONVERSIONS      = MAP_CONVERSIONS;
module.exports.ARR_CONVERSIONS      = ARR_CONVERSIONS;
