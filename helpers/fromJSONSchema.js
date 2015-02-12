
var url = require ('url');
var async = require ('async');
var merge = require ('./mergeJSONSchema');

/**     @module likeness */


var SIMPLE_CONVERSIONS = {
    'title':                '.title',
    'description':          '.description',
    'type':                 '.type',
    'enum':                 '.anyValue',
    'multiple':             '.multiple',
    'maximum':              '.max',
    'maxLength':            '.max',
    'maxItems':             '.max',
    'maxProperties':        '.max',
    'minimum':              '.min',
    'minLength':            '.min',
    'minItems':             '.min',
    'minProperties':        '.min',
    'uniqueItems':          '.unique',
    'pattern':              '.match'
};

var SIMPLE_CONVERSIONS_VALIDATION_EXTENSIONS = {
    'uniqueValues':         '.unique',
    'modulo':               '.modulo',
    'length':               '.length',
    'numProperties':        '.length',
    'match':                '.match',
    'times':                '.times'
};
for (var key in SIMPLE_CONVERSIONS)
    SIMPLE_CONVERSIONS_VALIDATION_EXTENSIONS[key] = SIMPLE_CONVERSIONS[key];

var SIMPLE_CONVERSIONS_TRANSFORM_EXTENSIONS = {
    'tolerant':             '.tolerant',
    'cast':                 '.cast',
    'set':                  '.setVal',
    'default':              '.default',
    'insert':               '.insert',
    'append':               '.append',
    'prepend':              '.prepend',
    'normalize':            '.normal',
    'add':                  '.add',
    'subtract':             '.subtract',
    'multiply':             '.multiply',
    'divide':               '.divide',
    'modulate':             '.modulate',
    'invert':               '.inverse',
    'reciprocal':           '.reciprocal',
    'case':                 '.case',
    'rename':               '.rename',
    'drop':                 '.drop',
    'clip':                 '.clip',
    'slice':                '.slice'
};
for (var key in SIMPLE_CONVERSIONS)
    SIMPLE_CONVERSIONS_TRANSFORM_EXTENSIONS[key] = SIMPLE_CONVERSIONS[key];
for (var key in SCHEMA_CONVERSIONS_VALIDATION_EXTENSIONS)
    SIMPLE_CONVERSIONS_TRANSFORM_EXTENSIONS[key] = SCHEMA_CONVERSIONS_VALIDATION_EXTENSIONS[key];

var SCHEMA_CONVERSIONS = {
    'additionalItems':      '.extras',
    'not':                  '.not'
};

var SCHEMA_CONVERSIONS_VALIDATION_EXTENSIONS = {
    'values':               '.all',
    'equals':               '.value',
    'keyFormat':            '.keyFormat'
};
for (var key in SCHEMA_CONVERSIONS)
    SCHEMA_CONVERSIONS_VALIDATION_EXTENSIONS[key] = SCHEMA_CONVERSIONS[key];

var SCHEMA_CONVERSIONS_TRANSFORM_EXTENSIONS = SCHEMA_CONVERSIONS_VALIDATION_EXTENSIONS;

var MAP_CONVERSIONS = {
    'properties':           '.children',
    'patternProperties':    '.matchChildren'
};

var ARR_CONVERSIONS = {
    'anyOf':                '.anyOf',
    'oneOf':                '.oneOf'
};

var ARR_CONVERSIONS_VALIDATION_EXTENSIONS = {
    'thereExists':          '.exists',
};
for (var key in ARR_CONVERSIONS)
    ARR_CONVERSIONS_VALIDATION_EXTENSIONS[key] = ARR_CONVERSIONS[key]

var ARR_CONVERSIONS_TRANSFORM_EXTENSIONS = ARR_CONVERSIONS_VALIDATION_EXTENSIONS;

var SKIP_STEPS = { };
// for (var key in SCHEMA_CONVERSIONS) SKIP_STEPS[key] = true;
for (var key in MAP_CONVERSIONS) SKIP_STEPS[key] = true;
for (var key in ARR_CONVERSIONS) SKIP_STEPS[key] = true;



/**     @property/Function fromJSONSchema
    Convert a JSON Schema spec to a likeness schema object. Does *not* create a Likeness instance.
@argument/Object schema
    JSON Schema document
*/
function fromJSONSchema (schema, callback, context, path) {
    context = context || schema;
    path = path || '#';

    var output = { '.optional':true, '.adHoc':true };
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
            return fromJSONSchema (subschema, function (err, sublikeness) {
                if (err) return callback (err);
                output[SCHEMA_CONVERSIONS[key]] = sublikeness;
                callback();
            }, context, path);
        }

        if (Object.hasOwnProperty.call (MAP_CONVERSIONS, key)) {
            var converted = {};
            return async.each (Object.keys (subschema), function (subkey, callback) {
                var subsubschema = subschema[subkey];
                if (typeof subsubschema != 'object') {
                    converted[subkey] = subsubschema;
                    return callback();
                }
                fromJSONSchema (subschema[subkey], function (err, sublikeness) {
                    if (err) return callback (err);
                    converted[subkey] = sublikeness;
                    callback();
                }, context, path+'/'+key+'/'+subkey);
            }, function (err) {
                if (err) return callback (err);
                output[MAP_CONVERSIONS[key]] = converted;
                callback();
            });
        }

        if (Object.hasOwnProperty.call (ARR_CONVERSIONS, key)) {
            var converted = [];
            return async.times (subschema.length, function (subI, callback) {
                fromJSONSchema (subschema[subI], function (err, sublikeness) {
                    if (err) return callback (err);
                    converted[subI] = sublikeness;
                    callback();
                }, context, path);
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
                    fromJSONSchema (subschema[subI], function (err, sublikeness) {
                        if (err) return callback (err);
                        converted[subI] = sublikeness;
                        callback();
                    }, context, path + '/items');
                }, function (err) {
                    if (err) return callback (err);
                    output['.sequence'] = converted;
                    callback();
                });
            }

            // single schema -> .all
            return fromJSONSchema (subschema, function (err, sublikeness) {
                if (err) return callback (err);
                output['.all'] = sublikeness;
                callback();
            }, context, path + '/items');
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
                return callback();
            } else
                return fromJSONSchema (subschema, function (err, sublikeness) {
                    if (err) return callback (err);
                    output['.extras'] = sublikeness;
                    callback();
                }, context, path);
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
                fromJSONSchema (subschema[subkey], function (err, sublikeness) {
                    if (err) return callback (err);
                    converted[subkey] = sublikeness;
                    callback();
                }, context, path+'/'+key+'/'+subkey);
            }, function (err) {
                if (err) return callback (err);
                output['.dependencies'] = converted;
                callback();
            });
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
            if (!output['.min'])
                return callback (new Error ('specified exclusiveMinimum but no minimum'));
            else {
                output['.exclusiveMin'] = output['.min'];
                delete output['.min'];
            }
        if (exMax) // ex-lax hurr hurr
            if (!output['.max'])
                return callback (new Error ('specified exclusiveMaximum but no maximum'));
            else {
                output['.exclusiveMax'] = output['.max'];
                delete output['.max'];
            }

        // required / optional
        if (schema.required)
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

        callback (undefined, output);
    });
}

module.exports = fromJSONSchema;
