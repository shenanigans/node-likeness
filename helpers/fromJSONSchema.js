
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


/**     @property/Function fromJSONSchema
    Convert a JSON Schema spec to a non-canonical likeness schema.
@argument/Object schema
    JSON Schema document
*/
function fromJSONSchema (schema, callback, context) {
    context = context || schema;

    var output = { '.optional':true };
    var keys = Object.keys (schema);
    async.each (keys, function (key, callback) {
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
            }, context);

        if (Object.hasOwnProperty.call (MAP_CONVERSIONS, key)) {
            var converted = {};
            return async.each (Object.keys (subschema), function (subkey, callback) {
                fromJSONSchema (subschema[subkey], function (err, sublikeness) {
                    if (err) return callback (err);
                    converted[subkey] = sublikeness;
                    callback();
                }, context);
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
                }, context);
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
                    }, context);
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
            }, context);
        }

        if (key == '$ref') {
            // reference to another schema
            var info = url.parse (subschema);
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
