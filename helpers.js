
var Likeness = require ('./likeness');

/**     @module likeness */


var CONVERSIONS = {
    'title':                '.title',
    'description':          '.description',
    'type':                 '.type',
    'properties':           '.children',
    'patternProperties':    '.matchChildren',
    'additionalProperties': '.extras',
    'additionalItems':      '.extras',
    'enum':                 '.anyValue',
    'anyOf':                '.anyOf',
    'oneOf':                '.oneOf',
    'not':                  '.not'
};


/**     @property/Function Joker
    Create a schema that represents arbitrary data of any type.
@argument/Boolean optional
    @optional
    Whether the Joker needs to exist at all.
@returns/likeness
    New pre-configured likeness.
*/
function Joker (optional) {
    var options = { '.adHoc':true };
    if (optional) optional['.optional'] = true;

    return new Likeness (options);
}


/**     @property/Function fromJSONSchema
    Convert a JSON Schema spec to a likeness schema and instantiate a new likeness with it.
@argument/Object schema
    JSON Schema document
@callback
    @argument/Error|undefined err
        If the schema document was invalid or relevant remote schema documents could not be
        retrieved, the offending Error is returned.
    @argument/undefined|likeness likeness
        A new likeness instance, or `undefined` if an Error occured.
*/
function fromJSONSchema (schema, callback) {

}


module.exports.Joker = Joker;
