
var fromJSONSchema = require ('./fromJSONSchema');

var SIMPLE_CONVERSIONS = {};
for (var key in fromJSONSchema.SIMPLE_CONVERSIONS)
    SIMPLE_CONVERSIONS[fromJSONSchema[key]] = key;

var SCHEMA_CONVERSIONS = {};
for (var key in fromJSONSchema.SCHEMA_CONVERSIONS)
    SCHEMA_CONVERSIONS[fromJSONSchema[key]] = key;

var MAP_CONVERSIONS = {};
for (var key in fromJSONSchema.MAP_CONVERSIONS)
    MAP_CONVERSIONS[fromJSONSchema[key]] = key;

var ARR_CONVERSIONS = {};
for (var key in fromJSONSchema.ARR_CONVERSIONS)
    ARR_CONVERSIONS[fromJSONSchema[key]] = key;
ARR_CONVERSIONS['.sequence'] = 'items';

function toJSONSchema (likeDoc) {
    var output = {};
    var keys = Object.keys (likeDoc);
    var deferred, required;
    for (var i=0,j=keys.length; i<j; i++) {
        var key = keys[i];
        var subschema = schema[key];

        if (Object.hasOwnProperty.call (SIMPLE_CONVERSIONS, key)) {
            output[SIMPLE_CONVERSIONS[key]] = subschema;
            continue;
        }

        if (Object.hasOwnProperty.call (SCHEMA_CONVERSIONS, key)) {
            // is this actually a simple key?
            if (typeof subschema == 'object')
                output[SCHEMA_CONVERSIONS[key]] = toJSONSchema (subschema);
            else
                output[SCHEMA_CONVERSIONS[key]] = subschema;
            continue;
        }

        if (Object.hasOwnProperty.call (MAP_CONVERSIONS, key)) {
            var converted = {};
            var subkeys = Object.keys (subschema);
            for (k=0,l=subkeys.length; k<l; k++) {
                var subkey = subkeys[k];
                converted[subkey] = toJSONSchema (subschema[subkey]);
            }
            output[MAP_CONVERSIONS[key]] = converted;
            continue;
        }

        if (Object.hasOwnProperty.call (ARR_CONVERSIONS, key)) {
            var converted = [];
            for (var k=0,l=subschema.length; k<l; k++)
                converted[k] = toJSONSchema (subschema[k]);
            output[ARR_CONVERSIONS[key]] = converted;
            continue;
        }

        if (key == '.sequence') {

        }

        if (key == '.all') {

        }

        if (key == '.extras') {

        }

        if (key == '.gte') {
            output.exclusiveMinimum = true;
            output.minimum = Object.hasOwnProperty.call (output, 'minimum') ?
                Math.min (subschema, output.minimum)
              : subschema
              ;
            continue;
        }

        if (key == '.lte') {
            output.exclusiveMaximum = true;
            output.maximum = Object.hasOwnProperty.call (output, 'maximum') ?
                Math.max (subschema, output.maximum)
              : subschema
              ;
            continue;
        }

        if (key == '.dependencies') {

            continue;
        }
    }
}
module.exports = toJSONSchema;
