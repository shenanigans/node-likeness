
var url = require ('url');
var Context = require ('./Context');

/**     @property/Function likeness.helpers.compileJSONSchema
    Resolves local and remotely resolved content within a JSON Schema metadocument, including
    retrieval of
@argument/Object schema
@argument/String id
    @optional
    If the `id` property is not set on the schema to be compiled, you can provide it here. Without
    an id, a fully-qualified `$ref` into this schema will call out to the internet.
@argument/likeness.helpers.Context context
    @optional
@argument/JSON options
    @optional
    Detailed options for when and how remote schema are resolved.
    @property/Number (options.timeout
    @property/Object (options.allowDomains
        @optional
    @property/Object (options.banDomains
        @optional
@callback
    @argument/Error|undefined err
        Compilation or network errors.
    @argument/undefined|Object compiledSchema
        Fully-resolved schema object, with every `$ref` replaced with resolved schemata.
    @argument/undefined|Object metaschema
        The standard or retrieved schema describing `compiledSchema`.
    @argument/undefined|likeness.helpers.Context context
        Resolution context storing compiled dependencies
*/
function compileJSONSchema (schema) {
    var id, context, options, callback;
    if (arguments.length < 2)
        throw new Error ('must supply a minimum of one (1) schema and one (1) callback');
    if (arguments.length == 2) {
        callback = arguments[1];
    } else {
        if (arguments.length > 5)
            throw new Error ("why can't I hold all these arguments???");
        for (var i=1, j=arguments.length-1; i<j; i++) {
            var candidate = arguments[i];
            if (candidate instanceof String)
                id = candidate;
            else if (candidate instanceof Context)
                context = candidate;
            else
                options = candidate;
        }
        callback = arguments[arguments.length-1];
    }

    var path;
    if (id)
        path = url.parse (id);
    if (!context)
        context = new (Context (id, schema));
}
