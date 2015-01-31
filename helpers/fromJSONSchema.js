
var url = require ('url');
var async = require ('async');

/**     @module likeness */


var SIMPLE_CONVERSIONS = {
    'title':                '.title',
    'description':          '.description',
    'type':                 '.type',
    'enum':                 '.anyValue',
    'multiple':             '.multiple',
    'maximum':              '.max',
    'maximumLength':        '.max',
    'maxItems':             '.max',
    'maxProperties':        '.max',
    'exclusiveMaximum':     '.exclusiveMax',
    'minimum':              '.min',
    'minimumLength':        '.min',
    'minItems':             '.min',
    'minProperties':        '.min',
    'exclusiveMinimum':     'exclusiveMin',

    // ================================================== Extensions
};

var SCHEMA_CONVERSIONS = {
    'additionalProperties': '.extras',
    'additionalItems':      '.extras',
    'not':                  '.not',

    // ================================================== Extensions
};

var MAP_CONVERSIONS = {
    'properties':           '.children',
    'patternProperties':    '.matchChildren',

    // ================================================== Extensions
};

var ARR_CONVERSIONS = {
    'anyOf':                '.anyOf',
    'oneOf':                '.oneOf',

    // ================================================== Extensions
};

var SKIP_STEPS = {};
for (var key in SCHEMA_CONVERSIONS) SKIP_STEPS[key] = true;
for (var key in MAP_CONVERSIONS) SKIP_STEPS[key] = true;
for (var key in ARR_CONVERSIONS) SKIP_STEPS[key] = true;

/**     @property/Function fromJSONSchema
    Convert a JSON Schema spec to a non-canonical likeness schema.
@argument/Object schema
    JSON Schema document
*/
function fromJSONSchema (schema, callback, context, path) {
    context = context || schema;
    path = path || '#';

    var output = { '.optional':true };
    var keys = Object.keys (schema);
    async.each (keys, function (key, callback) {
        if (key == '$ref') console.log ('ref', schema[key]);
        var subschema = schema[key];

        if (Object.hasOwnProperty.call (SIMPLE_CONVERSIONS, key)) {
            output[SIMPLE_CONVERSIONS[key]] = subschema;
            return callback();
        }

        if (Object.hasOwnProperty.call (SCHEMA_CONVERSIONS, key))
            return fromJSONSchema (subschema, function (err, sublikeness) {
                if (err) return callback (err);
                output[SCHEMA_CONVERSIONS[key]] = sublikeness;
                callback();
            }, context, path);

        if (Object.hasOwnProperty.call (MAP_CONVERSIONS, key)) {
            var converted = {};
            return async.each (Object.keys (subschema), function (subkey, callback) {
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
                var sequence = [];
                return async.times (subschema.length, function (subI, callback) {
                    fromJSONSchema (subschema[subI], function (err, sublikeness) {
                        if (err) return callback (err);
                        converted[subI] = sublikeness;
                        callback();
                    }, context, path);
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
            }, context, path);
        }

        if (key == '$ref') {
            console.log ('----------- refrefref '+path);
            // reference to another schema
            var info = url.parse (subschema);
            if (path.slice (0, info.hash.length) != info.hash)
                throw new Error ('non-recursive reference detected');

            var middlePath = path.slice (info.hash.length).split ('/');
            for (var i=0, j=middlePath.length; i<j; i++) {
                var step = middlePath[i];
                if (Object.hasOwnProperty.call (SKIP_STEPS, step)) {
                    middlePath.splice (i);
                    i--; j--;
                }
            }
            output['.recurse'] = middlePath.length;
            return callback();
        }

        callback();
    }, function (err) {
        if (err) return callback (err);

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
