
var url = require ('url');
var needle = require ('needle');
var getTypeStr = require ('../lib/GetTypeStr');

var standardSchemata = {
    "http://json-schema.org/schema":                    require ('./JSPredefs/draft04.json'),
    "http://json-schema.org/hyper-schema":              require ('./JSPredefs/draft04_hyper.json'),
    "http://json-schema.org/draft-04/schema":           require ('./JSPredefs/draft04.json'),
    "http://json-schema.org/draft-04/hyper-schema":     require ('./JSPredefs/draft04_hyper.json'),
    "http://json-schema.org/draft-03/schema":           require ('./JSPredefs/draft03_hyper.json'),
    "http://json-schema.org/draft-03/hyper-schema":     require ('./JSPredefs/draft03_hyper.json')
};

var DEFAULT_OPTIONS = {
    timeout:    3000,
    maxDepth:   10
};

/**     @class likeness.helpers.JSContext
    @root

@Object #namespace
@Object #universeCache
@Object #queues
    Clip a url between protocol and hash -
*/
function JSContext (options) {
    options = options || {};
    this.options = {};
    for (var key in DEFAULT_OPTIONS)
        if (Object.hasOwnProperty.call (options))
            this.options[key] = options[key];
        else
            this.options[key] = DEFAULT_OPTIONS[key];
    this.namespace = {};
    this.universeCache = {};
    for (var key in standardSchemata)
        this.universeCache[key] = standardSchemata[key];
    this.queues = {};
}
module.exports = JSContext;


/**     @membger/Function submit
    Recursively scan a schema document for subschema and register each recognized subschema path.
@argument/String id
    @optional
@argument/Object schema
@callback
    @argument/Error|undefined err
*/
JSContext.prototype.submit = function (id, schema, callback, chain) {
    if (arguments.length == 3) {
        chain = callback;
        callback = schema;
        schema = id;
        id = undefined;
    } else if (arguments.length == 2) {
        callback = schema;
        schema = id;
        id = chain = undefined;
    }

    // walk to target namespace
    id = id || schema.id;
    var namespace = this.namespace;
    var prefix = '#';
    if (id)  {
        var path = url.parse (id);
        var pathHost = path.host || '';
        var pathPath = path.path || '';
        prefix = path.hash || '#';
        if (pathHost)
            if (Object.hasOwnProperty.call (namespace, pathHost))
                namespace = namespace[pathHost];
            else
                namespace = namespace[pathHost] = {};
        if (pathPath)
            if (Object.hasOwnProperty.call (namespace, pathPath))
                namespace = namespace[pathPath];
            else
                namespace = namespace[pathPath] = {};
    }

    // resolve the metaschema
    var self = this;
    var metaschemaPath = schema.$schema || "http://json-schema.org/schema";
    JSContext.resolve (metaschemaPath, function (err, metaschema) {
        for (var key in schema) {
            // the standard metaschema specifies definitions among properties, even though it's not
            // a reserved name
            if (Object.hasOwnProperty.call (metaschema.properties, key) && key != 'definitions')
                continue; // ignore reserved props

            (function submitSubschema (path, level) {
                var localNamespace = namespace;

                if (level.id) {
                    // shift to an alternate namespace
                    var path = url.parse (level.id);
                    var pathHost = path.host || '';
                    var pathPath = path.path || '';
                    if (pathHost)
                        if (Object.hasOwnProperty.call (self.namespace, pathHost))
                            localNamespace = self.namespace[pathHost];
                        else
                            localNamespace = self.namespace[pathHost] = {};
                    if (pathPath)
                        if (Object.hasOwnProperty.call (localNamespace, pathPath))
                            localNamespace = localNamespace[pathPath];
                        else
                            localNamespace = localNamespace[pathPath] = {};
                    path = level.hash ? level.hash.slice (1) : '/';
                }

                for (var key in level) {
                    if (
                        Object.hasOwnProperty.call (metaschema.properties, key)
                     && key != 'definitions'
                    )
                        continue; // ignore reserved props

                    submitSubschema (path + '/' + key, level[key]);
                }

                namespace[path] = level;
            }) (prefix + '/' + key, schema[key]);
        }

        namespace[prefix] = schema;
    }, chain);
};


/**     @member/Function resolve
    Acquire a schema for a local or remote reference.
@argument/String ref
@callback
    @argument/Error|undefined err
    @argument/undefined|Object schema
@argument/Array[String] chain
    @optional
    @development
*/
JSContext.prototype.resolve = function (ref, callback, chain) {
    var self = this;
    var path = url.parse (ref);

    // locate the correct namespace
    var namespace = this.namespace;
    var pathHost = path.host || '';
    var pathPath = path.path || '';
    var hash = path.hash || '#';
    if (pathHost) // leave the namespace and enter the universe
        if (Object.hasOwnProperty.call (namespace, pathHost))
            namespace = this.universeCache[pathHost];
        else
            namespace = this.universeCache[pathHost] = {};
    if (pathPath)
        if (Object.hasOwnProperty.call (namespace, pathPath))
            namespace = namespace[pathPath];
        else
            namespace = namespace[pathPath] = {};

    // any chance it's already been resolved?
    if (Object.hasOwnProperty (namespace, hash))
        return process.nextTick (function(){ callback (undefined, namespace[hash]); });

    if (!pathHost) // local references won't get any more resolvable
        return process.nextTick (function(){ callback (new Error (
            'cannot resolve local reference ' + ref
        )); });

    var canonicalURL = path.host + path.path;

    // cycle detection
    if (!chain)
        chain = [ canonicalURL ];
    else {
        // you can easily build a malicious server to defeat cycle detection
        // chain depth limiting
        if (chain.length >= this.options.maxDepth)
            return process.nextTick (function(){ callback (new Error (
                'maximum resolution depth exceeded'
            )); });

        // does this url appear in the chain already?
        for (var i=0,j=chain.length; i<j; i++)
            if (chain[i] == canonicalURL)
                return callback (new Error (

        // clone the chain and append the current url
        var newChain = [];
        newChain.push.apply (newChain, chain);
        newChain.push (canonicalURL);
        chain = newChain;
    }

    // is there already a request in progress for this path?
    if (Object.hasOwnProperty.call (this.queues, canonicalURL)) {
        this.queues[canonicalURL].push (callback);
        return;
    }

    // begin a new request
    this.queues[canonicalURL] = [ callback ];
    needle.get (
        'https://' + canonicalURL,
        { timeout:this.options.timeout },
        function (err, response) {
            if (err) return callback (err);
            if (response.headers['content-type'].slice (0, 23) != 'application/schema+json')
                return callback (new Error (
                    'failed to resolve a schema from the remote server - ' + canonicalURL
                ));

            // submit the entire reply to cache
            self.submit (canonicalURL, response.body);

            // resolve from cache
            var err, result;
            if (!Object.hasOwnProperty (namespace, hash))
                err = new Error ('cannot resolve remote reference '+ref);
            else
                result = namespace[hash];

            // flush the queue
            var queue = self.queues[canonicalURL];
            delete self.queues[canonicalURL];
            for (var i=0,j=queue.length; i<j; i++)
                queue[i] (err, result);
        }
    );
};


/**     @member/Function compile
    Resolve and recursively scan a schema, resolving all non-recursive references.
@argument/String ref
@callback
    @argument/Error|undefined err
    @argument/undefined|Object compilation
*/
JSContext.prototype.compile = function (ref, callback) {
    var self = this;
    this.resolve (ref, function (err, schema) {
        if (err) return callback (err);

        function compileLevel (path, level, callback) {
            var isObj = false;
            var compilation = [];
            var iter = level;
            var keys;
            if (!(level instanceof Array)) {
                isObj = true;

                if (Object.hasOwnProperty.call (level, '$ref')) { // it's a reference!
                    // is it a recursive reference?
                    var refPath = url.parse (level.$ref);
                    if (!refPath.host && !refPath.path) {
                        // it's local, but is it recursive?
                        var outerPath = url.parse (path);
                        if (
                            outerPath.hash
                         && outerPath.hash.length > refPath.hash.length
                         && outerPath.hash.slice (0, refPath.hash.length) == refPath.hash
                        ) // it's recursive!
                            return process.nextTick (function(){
                                callback (undefined, { $ref:level.$ref });
                            });
                    }

                    return self.compile (level.$ref, function (err, resolved) {
                        if (err) return callback (err);
                        callback (undefined, resolved);
                    }, chain);
                }
                keys = Object.keys (level);
                iter = keys;
            }

            async.times (iter.length, function (sublevelI, callback) {
                var sublevel = iter[sublevelI];

                // properties is special - it may contain the key "$ref" without being a reference
                if (isObj && keys[sublevelI] == 'properties') {
                    // a dream within a dream
                    var propKeys = Object.keys (sublevel);
                    var propCompilation = [];
                    return async.times (propKeys.length, function (propKeysI, callback) {
                        compileLevel (
                            sublevel[propKeys[propKeysI]],
                            function (err, compiledProperty) {
                                if (err) return callback (err);
                                propCompilation[propKeysI] = compiledProperty;
                                callback();
                            }
                        );
                    }, function (err) {
                        if (err) return callback (err);
                        var propOutput = {};
                        for (var i=0,j=propCompilation.length; i<j; i++)
                            propOutput[propKeys[i]] = propCompilation[i];
                        compilation[sublevelI] = propOutput;
                        callback();
                    });
                });

                }
                if (typeof sublevel != 'object') {
                    iter[sublevelI] = sublevel;
                    return callback();
                }
                compileLevel (sublevel, function (err, compiledSublevel) {
                    if (err) return callback (err);
                    compilation[sublevelI] = compiledSublevel;
                    callback();
                });
            }, function (err) {
                if (err) return callback (err);
                if (!isObj)
                    return callback (undefined, compilation);

                var output = {};
                for (var i=0,j=compilation.length; i<j; i++)
                    output[keys[i]] = compilation[i];
                callback (undefined, output);
            });
        }

        var keys = Object.keys (schema);
        var compilation = [];
        async.times (keys, function (keyI, callback) {
            var refPath = url.parse (ref);
            var refHash = ;
            compileLevel (schema[keys[keyI]], refPath.hash || '#', function (err, compiledLevel) {
                if (err) return callback (err);
                compilation[keyI] = compiledLevel;
                callback();
            });
        }, function (err) {
            if (err) return callback (err);
            var output = {};
            for (var i=0,j=compilation.length; i<j; i++)
                output[keys[i]] = compilation[i];
            callback (undefined, output);
        }
    });
};
