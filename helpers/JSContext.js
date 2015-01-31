
var url = require ('url');
var async = require ('async');
var needle = require ('needle');
var getTypeStr = require ('../lib/GetTypeStr');

var STD_DRAFT_04 = require ('./JSPredefs/draft04.json');
var STD_DRAFT_03 = require ('./JSPredefs/draft03.json');
var STD_DRAFT_04_HYPER = require ('./JSPredefs/draft04_hyper.json');
var STD_DRAFT_03_HYPER = require ('./JSPredefs/draft03_hyper.json');
var standardSchemata = {
    "json-schema.org":          {
        "/schema":                  STD_DRAFT_04,
        "/hyper-schema":            STD_DRAFT_04_HYPER,
        "/draft-04/schema":         STD_DRAFT_04,
        "/draft-04/hyper-schema":   STD_DRAFT_04_HYPER,
        "/draft-03/schema":         STD_DRAFT_03,
        "/draft-03/hyper-schema":   STD_DRAFT_03_HYPER
    }
};
var DEFAULT_OPTIONS = {
    timeout:    3000,
    maxDepth:   10
};

/**     @class likeness.helpers.JSContext
    @root

@Object #universeCache
    This multi-layer cache is organized as `{ "hostName.com":{ "/path":{ "#hash":{
    $schema:"http://json-schema.org ...`
@Object #queues
    URLs (without hash portion) with concurrent active requests mapped to Arrays of callbacks. Used
    to prevent multiple network requests to the same URL.
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
    for (var host in standardSchemata) {
        var standardPaths = this.universeCache[host] = {};
        for (var path in standardSchemata[host]) {
            this.universeCache[host][path] = { '#':standardSchemata[host][path] };
        }
    }
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
    // walk to target namespace
    var path = url.parse (id);
    var pathHost = path.host;
    var pathPath = path.path || '/';
    if (pathPath[0] != '/')
        pathPath = '/' + pathPath;
    var hash = path.hash || '#';
    var namespace;
    if (Object.hasOwnProperty.call (this.universeCache, path.host))
        namespace = this.universeCache[path.host];
    else
        namespace = this.universeCache[path.host] = {};
    if (pathPath)
        if (Object.hasOwnProperty.call (namespace, pathPath))
            namespace = namespace[pathPath];
        else
            namespace = namespace[pathPath] = {};

    // resolve the metaschema
    var self = this;
    var metaschemaPath = schema.$schema || "http://json-schema.org/schema";
    this.resolve (metaschemaPath, function (err, metaschema) {
        if (err) return callback (err);
        for (var key in schema) {
            // the standard metaschema specifies definitions among properties, even though it's not
            // a reserved name
            if (Object.hasOwnProperty.call (metaschema.properties, key) && key != 'definitions')
                continue; // ignore reserved props

            (function submitSubschema (path, level, parent) {
                var localNamespace = namespace;
                if (level.id) {
                    // shift to an alternate namespace
                    var newParent = url.parse (level.id);
                    var pathHost = newParent.host || parent.host;
                    var pathPath = newParent.path || parent.path;
                    if (pathPath[0] != '/')
                        pathPath = '/' + pathPath;
                    path = newParent.hash || '#';
                    parent = {
                        host:   pathHost,
                        path:   pathPath,
                        hash:   path
                    };
                    if (Object.hasOwnProperty.call (self.universeCache, pathHost))
                        localNamespace = self.universeCache[pathHost];
                    else
                        localNamespace = self.universeCache[pathHost] = {};
                    if (pathPath)
                        if (Object.hasOwnProperty.call (localNamespace, pathPath))
                            localNamespace = localNamespace[pathPath];
                        else
                            localNamespace = localNamespace[pathPath] = {};
                }

                for (var key in level) {
                    if (
                        Object.hasOwnProperty.call (metaschema.properties, key)
                     && key != 'definitions'
                    )
                        continue; // ignore reserved props

                    if (typeof level[key] == 'object')
                        submitSubschema (path + '/' + key, level[key], parent);
                }

                localNamespace[path] = level;
            }) (hash + '/' + key, schema[key], path);

        }
        namespace[hash] = schema;
        callback();
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
JSContext.prototype.resolve = function (parent, ref, callback, chain) {
    if (arguments.length == 2) {
        callback = ref;
        ref = parent;
        parent = chain = undefined;
    } else if (arguments.length == 3 && typeof ref == 'function') {
        chain = callback;
        callback = ref;
        ref = parent;
        parent = undefined;
    }

    var self = this;
    var path = url.parse (ref);

    // locate the correct namespace
    if (!path.host && !parent)
        return process.nextTick (function(){ callback (new Error (
            'could not resolve local reference without a parent hostname'
        )); });
    var pathHost = path.host || parent.host;
    var pathPath = path.path || parent.path;
    if (pathPath[0] != '/')
        pathPath = '/' + pathPath;
    var hash = path.hash || '#';
    var namespace;
    if (Object.hasOwnProperty.call (this.universeCache, pathHost))
        namespace = this.universeCache[pathHost];
    else
        namespace = this.universeCache[pathHost] = {};
    if (pathPath)
        if (Object.hasOwnProperty.call (namespace, pathPath))
            namespace = namespace[pathPath];
        else
            namespace = namespace[pathPath] = {};

    // cycle detection
    var canonicalURL = pathHost + pathPath + hash;
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
            if (chain[i] == canonicalURL) {
                return process.nextTick (function(){ callback (new Error (
                    'cycle detected in ref '
                  + ref
                  + '\n'
                  + chain.join (' -> ')
                  + ' -> '
                  + canonicalURL
                )); });
            }

        // clone the chain and append the current url
        var newChain = [];
        newChain.push.apply (newChain, chain);
        newChain.push (canonicalURL);
        chain = newChain;
    }

    // any chance it's already been resolved?
    if (Object.hasOwnProperty.call (namespace, hash))
        return process.nextTick (function(){ callback (undefined, namespace[hash], chain); });

    if (!pathHost && !pathPath) // local references won't get any more resolvable
        return process.nextTick (function(){ callback (new Error (
            'cannot resolve local reference ' + ref
        )); });


    // is there already a request in progress for this path?
    if (Object.hasOwnProperty.call (this.queues, canonicalURL)) {
        this.queues[canonicalURL].push (callback);
        return;
    }

    // begin a new request
    this.queues[canonicalURL] = [ callback ];
    var reserveStack = new Error().stack;
    needle.get (
        (path.protocol || 'https:') + '//' + canonicalURL,
        { timeout:this.options.timeout },
        function (err, response) {
            if (err) {
                var queue = self.queues[canonicalURL];
                delete self.queues[canonicalURL];
                for (var i=0,j=queue.length; i<j; i++)
                    queue[i] (err);
                return;
            }

            // if (response.headers['content-type'].slice (0, 23) != 'application/schema+json')
            //     return callback (new Error (
            //         'failed to resolve a schema from the remote server - ' + canonicalURL
            //     ));
            if (response.body instanceof Buffer || typeof response.body == 'string') {
                try {
                    response.body = JSON.parse (response.body);
                } catch (err) {
                    return callback (new Error (
                        'received invalid schema document from ' + canonicalURL
                      + ' ('+pathHost+')  ('+pathPath+')'
                    ));
                }
            }

            // submit the entire reply to cache
            self.submit ('http://'+canonicalURL, response.body, function (needleErr) {
                if (needleErr) {
                    // flush the queue
                    var queue = self.queues[canonicalURL];
                    delete self.queues[canonicalURL];
                    for (var i=0,j=queue.length; i<j; i++)
                        queue[i] (needleErr);
                    return;
                }
                // resolve from cache
                var err, result;
                if (!Object.hasOwnProperty.call (namespace, hash))
                    err = new Error ('cannot resolve remote reference '+ref);
                else
                    result = namespace[hash];

                // flush the queue
                var queue = self.queues[canonicalURL];
                delete self.queues[canonicalURL];
                for (var i=0,j=queue.length; i<j; i++)
                    queue[i] (err, result, chain);
            }, chain);
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
JSContext.prototype.resolveCompiled = function (parent, ref, callback, chain) {
    if (arguments.length == 2) {
        callback = ref;
        ref = parent;
        parent = url.parse (ref);
    } else if (arguments.length == 3 && typeof ref != 'string') {
        chain = callback;
        callback = ref;
        ref = parent;
        parent = url.parse (ref);
    }

    var self = this;
    this.resolve (parent, ref, function (err, schema, chain) {
        if (err) return callback (err);
        self.compile (parent, schema, callback, chain);
    }, chain);
};


/**     @member/Function compile
    Resolve and recursively scan a schema, resolving all non-recursive references.
@argument/String ref
@callback
    @argument/Error|undefined err
    @argument/undefined|Object compilation
*/
var ASS = {};
JSContext.prototype.compile = function (parent, schema, callback, chain) {
    if (arguments.length == 2) {
        callback = schema;
        schema = parent;
        parent = chain = undefined;
    } else if (arguments.length == 3 && typeof schema == 'function') {
        chain = callback;
        callback = schema;
        schema = parent;
        parent = undefined;
    }

    if (!parent) {
        if (!schema.id)
            return process.nextTick (function(){ callback (new Error (
                'cannot compile a schema without knowing what path it represents'
            )); });
        parent = schema.id;
    }
    if (typeof parent == 'string')
        parent = url.parse (parent);

    var self = this;
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
                if (
                    ( !refPath.host || parent && refPath.host == parent.host )
                 && ( !refPath.path || parent && refPath.path == parent.path )
                ) {
                    // it's local, but is it recursive?
                    var outerPath;
                    if (parent)
                        outerPath = url.parse ('https://'+parent.host+parent.path+path);
                    else
                        outerPath = url.parse (path);

                    if (
                        outerPath.hash
                     && outerPath.hash.length > refPath.hash.length
                     && outerPath.hash.slice (0, refPath.hash.length) == refPath.hash
                    ) { // it's recursive!
                        return process.nextTick (function(){
                            callback (undefined, { $ref:level.$ref });
                        });
                    }
                }

                var pseudoParent = {
                    host:       refPath.host || parent.host,
                    path:       refPath.path || parent.path,
                    hash:       refPath.hash
                };
                if (pseudoParent.path[0] != '/')
                    pseudoParent.path = '/' + pseudoParent.path;
                return self.resolveCompiled (pseudoParent, level.$ref, function (err, resolved) {
                    if (err) return callback (err);
                    callback (undefined, resolved);
                }, chain);
            }

            keys = Object.keys (level);
            iter = [];
            for (var i=0,j=keys.length; i<j; i++)
                iter[i] = level[keys[i]];
        }

        async.timesSeries (iter.length, function (sublevelI, callback) {
            var sublevel = iter[sublevelI];

            // properties is special - it may contain the key "$ref" without being a reference
            if (isObj && keys[sublevelI] == 'properties') {
                // a dream within a dream
                var propKeys = Object.keys (sublevel);
                var propCompilation = [];
                return async.timesSeries (propKeys.length, function (propKeysI, callback) {
                    compileLevel (
                        path + '/properties/' + propKeys[propKeysI],
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
            }

            if (typeof sublevel != 'object') {
                compilation[sublevelI] = sublevel;
                return callback();
            }
            compileLevel (
                path,
                sublevel,
                function (err, compiledSublevel) {
                    if (err) return callback (err);
                    compilation[sublevelI] = compiledSublevel;
                    callback();
                }
            );
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
    async.timesSeries (keys.length, function (keyI, callback) {
        var key = keys[keyI];
        var val = schema[key];
        if (typeof val != 'object') {
            compilation[keyI] = val;
            return callback();
        }
        compileLevel ((parent.hash||'#')+key, val, function (err, compiledLevel) {
            if (err) return callback (err);
            compilation[keyI] = compiledLevel;
            callback();
        });
    }, function (err) {
        if (err) return process.nextTick (function(){ callback (err); });
        var output = {};
        for (var i=0,j=compilation.length; i<j; i++)
            if (keys[i] != '$schema')
                output[keys[i]] = compilation[i];
        process.nextTick (function(){ callback (undefined, output); });
    });
};
