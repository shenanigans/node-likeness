
var url = require ('url');
var async = require ('async');
var needle = require ('needle');
var getTypeStr = require ('../lib/GetTypeStr');
var merge = require ('./mergeJSONSchema');

var STD_DRAFT_04        = require ('./JSPredefs/draft04.json');
var STD_DRAFT_03        = require ('./JSPredefs/draft03.json');
var STD_DRAFT_04_HYPER  = require ('./JSPredefs/draft04_hyper.json');
var STD_DRAFT_03_HYPER  = require ('./JSPredefs/draft03_hyper.json');
var STD_LIKENESS        = require ('./JSPredefs/likeness_validations.json');
var STD_TRANSFORM       = require ('./JSPredefs/likeness_transforms.json');
var STD_CARD            = require ('./JSPredefs/card.json');
var STD_ADDRESS         = require ('./JSPredefs/address.json');
var STD_CALENDAR        = require ('./JSPredefs/calendar.json');
var STD_GEO             = require ('./JSPredefs/geo.json');
var standardSchemata = {
    "json-schema.org":          {
        "/schema":                  STD_DRAFT_04,
        "/likeness":                STD_LIKENESS,
        "/likeness/transform":      STD_TRANSFORM,
        "/hyper-schema":            STD_DRAFT_04_HYPER,
        "/draft-04/schema":         STD_DRAFT_04,
        "/draft-04/hyper-schema":   STD_DRAFT_04_HYPER,
        "/draft-03/schema":         STD_DRAFT_03,
        "/draft-03/hyper-schema":   STD_DRAFT_03_HYPER,
        "/card":                    STD_CARD,
        "/address":                 STD_ADDRESS,
        "/calendar":                STD_CALENDAR,
        "/geo":                     STD_GEO
    }
};
var submissions = [];
for (var host in standardSchemata)
    for (var path in standardSchemata[host])
        submissions.push ([ host+path, standardSchemata[host][path] ]);

var DEFAULT_OPTIONS = {
    timeout:    3000,
    maxDepth:   10
};

/**     @module/class likeness.helpers.JSContext
    A caching context for prefetching $ref statements. Fetches remote schemata only once per
    instance of `JSContext`. May be used to register a schema on a url whether or not it exists
    there on the interwebs, then compile schemata that reference that url.

    There are two outer surfaces to this interface: Use [compile](#compile) to prebuild a JSON
    Schema document before creating a [validator/transformer](likeness.fromJSONSchema) or use
    [resolveCompiled](#resolveCompiled) to fetch a compiled JSON Schema document.

    **warning** Do not ask a JSContext to process multiple jobs at once if any $ref statements are
    present or could conceivably be present.
@argument/json options
    @optional
    @String (options#timeout
        The maximum total time, in milliseconds, to spend chasing $ref statements across the network
        before declaring a timeout error.
    @String (options#maxDepth
        The maximum depth of $ref statements to traverse  follow
@Object #universeCache
    This multi-layer cache is organized as `{ "hostName.com":{ "/path":{ "#hash":{
    $schema:"http://json-schema.org ...`
@Object #queues
    URLs (without hash portion) with concurrent active requests mapped to Arrays of callbacks. Used
    to prevent multiple network requests to the same URL.
@Array<Function> #initQueue
    The first compile job must wait for the preset metaschema to be [submitted](#submit).
*/
function JSContext (options) {
    options = options || {};
    this.options = {};
    for (var key in DEFAULT_OPTIONS)
        if (Object.hasOwnProperty.call (options))
            this.options[key] = options[key];
        else
            this.options[key] = DEFAULT_OPTIONS[key];
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


/**     @member/Function init
    @development
    Not called directly. [Submits](#submit) the preset metaschema documents. [Compile](#compile)
    tasks that come in while the callbacks nextTick will be stacked onto [initQueue](#initQueue).
@callback
*/
JSContext.prototype.init = function (callback) {
    if (this.initQueue) {
        this.initQueue.push (callback);
        return;
    } else
        this.initQueue = [ callback ];

    var self = this;
    async.each (submissions, function (job, callback) {
        self.submit (job[0], job[1], function(){
            callback();
        })
    }, function(){
        self.initialized = true;
        var queue = self.initQueue;
        delete self.initQueue;
        for (var i=0,j=queue.length; i<j; i++)
            queue[i].call (this);
    });
};


/**     @membger/Function submit
    Recursively scan a schema document for subschema and register each recognized subschema path.
    This is strictly necessary due to the crazy whopping lies you can tell with the `id` key.
@argument/String id
    @optional
    The url where this schema is published. All unnamed schemata are mounted as
    "http://json-schema.org/default".
@argument/Object schema
    The schema document to submit to cache.
@callback
    @argument/Error|undefined err
        If a $ref statement cannot be resolved, an Error will be passed down.
*/
JSContext.prototype.submit = function (/* id, schema, callback */) {
    var id, schema, callback;
    switch (arguments.length) {
        case 2:
            schema = arguments[0];
            callback = arguments[1];
            id = schema.id || 'http://json-schema.org/default#';
            break;
        default:
            id = arguments[0] || 'http://json-schema.org/default#';
            schema = arguments[1];
            callback = arguments[2];
    }

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
        callback (undefined, metaschema);
    });
};


/**     @member/Function resolve
    Acquire a schema for a local or remote reference.
@argument/url:Location parent
@argument/String ref
@callback
    @argument/Error|undefined err
    @argument/undefined|Object schema
*/
JSContext.prototype.resolve = function (parent, ref, callback) {
    if (arguments.length == 2) {
        callback = ref;
        ref = parent;
        parent = {};
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
    // any chance it's already been resolved?
    if (Object.hasOwnProperty.call (namespace, hash))
        return process.nextTick (function(){ callback (undefined, namespace[hash]); });

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
    var basePath =
        ( path.protocol || ( ( parent && parent.protocol ) ? parent.protocol : 'https:' ) )
      + '//'
      + pathHost
      + pathPath
      ;
    needle.get (
        basePath,
        { timeout:this.options.timeout, parse:'json' },
        function (needleErr, response) {
            if (needleErr) {
                // flush queue with error
                var queue = self.queues[canonicalURL];
                delete self.queues[canonicalURL];
                for (var i=0,j=queue.length; i<j; i++)
                    queue[i] (needleErr);
                return;
            }

            // aggressively require the prescribed Content-Type header
            // if (response.headers['content-type'].slice (0, 23) != 'application/schema+json')
            //     return callback (new Error (
            //         'failed to resolve a schema from the remote server - ' + canonicalURL
            //     ));

            // submit the entire reply to cache
            self.submit (basePath, response.body, function (err) {
                if (err) {
                    // flush the queue
                    var queue = self.queues[canonicalURL];
                    delete self.queues[canonicalURL];
                    for (var i=0,j=queue.length; i<j; i++)
                        queue[i] (err);
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
                    queue[i] (err, result);
            });
        }
    );
};


/**     @member/Function resolveCompiled
    Resolve and scan a schema, resolving all non-recursive references by recursing into
    `resolveCompiled` again.
@argument/String mount
    @optional
    @development
    When calling recursively as part of compiling a parent document, the path in the compiled
    document where this fragment will be placed is passed. It is updated and passed to further
    compilation levels. It is used to updated the `replacements` map, which permits the compilation
    of recursive structures.
@argument/url:Location parent
    @optional
    @development
    When calling recursively as part of compiling a parent document, the url of the parent context
    for this call to `resolveCompiled` is passed. If `ref` is absolute, it is `ref` without the hash
    portion. If `ref` is local it is the url to which `ref` is local.
@argument/String ref
    The local or absolute path of a schema to prefetch in precompiled form.
@callback
    @argument/Error|undefined err
    @argument/undefined|Object compiledSchema
    @returns
@argument/Object replacements
    @optional
    @development
    A map of `ref` paths that have already been resolved to the local path which a $ref statement
    may now use.
*/
JSContext.prototype.resolveCompiled = function (mount, parent, ref, callback, replacements) {
    if (arguments.length == 2) {
        callback = ref;
        ref = parent;
        parent = url.parse (ref);
    }

    if (!replacements)
        replacements = {};

    var self = this;
    this.resolve (parent, ref, function (err, schema) {
        if (err) return callback (err);

        // ref to id
        ref = url.parse (ref);
        var compileID =
            ( ( ref.protocol || parent.protocol || 'https:' ) + '//' )
          + ( ref.host || parent.host )
          + ( ref.path || parent.path )
          // + ( ref.hash || parent.hash || '#' )
          ;
        self.compile (mount, parent, compileID, schema, callback, replacements);
    });
};


/**     @member/Function compile
    Recursively scan a schema document, prefetching all non-recursive references.
@argument/String mount
    @optional
    @development
@argument/url:Location parent
    @optional
    @development
@argument/String id
    @optional
@argument/Object schema
    The schema document to compile.
@callback
    @argument/Error|undefined err
    @argument/undefined|Object compilation
    @returns
@argument/Object replacements
*/
var ASS = {};
var RAW_KEYS = { inject:true, rename:true, default:true, sort:true };
JSContext.prototype.compile = function (mount, parent, id, schema, callback, replacements) {
    if (arguments.length == 2) {
        schema = arguments[0];
        callback = arguments[1];
        parent = id = undefined;
        replacements = {};
        mount = '#';
    } else if (arguments.length == 3) {
        callback = arguments[2];
        schema = arguments[1];
        id = arguments[0];
        parent = undefined;
        mount = '#';
    }
    if (!replacements) replacements = {};

    // chain depth limiting
    if (Object.keys (replacements).length >= this.options.maxDepth)
        return process.nextTick (function(){ callback (new Error (
            'maximum resolution depth exceeded'
        )); });

    var self = this;
    if (!this.initialized)
        return this.init (function(){ self.compile (mount, parent, id, schema, callback, replacements); });

    if (!id) {
        if (schema.id)
            id = schema.id;
        else
            id = 'http://json-schema.org/default#';
    }
    var idInfo = url.parse (id);
    if (!idInfo.hash)
        id += '#';

    if (!parent)
        parent = id;
    if (typeof parent == 'string')
        parent = url.parse (parent);

    this.submit (parent.href, schema, function (err, metaschema) {
        if (err) return callback (err);
        function compileLevel (path, level, callback) {
            var isObj = false;
            var compilation = [];
            var keys;

            // async recursion driver, named so as to be callable after inheriting a $ref
            var iter = level;
            function compileIterSublevel (sublevelI, callback) {
                var sublevel = iter[sublevelI];
                if (typeof sublevel != 'object') {
                    compilation[sublevelI] = sublevel;
                    return callback();
                }
                var key;
                if (isObj) {
                    key = keys[sublevelI];
                    if (Object.hasOwnProperty.call (RAW_KEYS, key)) {
                        compilation[sublevelI] = sublevel;
                        return callback();
                    }
                }

                // properties is special - it may contain the key "$ref" without being a reference
                if (
                    isObj
                 && (
                        key == 'properties'
                     || key == 'patternProperties'
                     || key == 'dependencies'
                 )
                ) {
                    // a dream within a dream
                    var propKeys = Object.keys (sublevel);
                    var propCompilation = [];
                    return async.timesSeries (propKeys.length, function (propKeysI, callback) {
                        var subsublevel = sublevel[propKeys[propKeysI]];
                        if (typeof subsublevel != 'object') {
                            propCompilation[propKeysI] = subsublevel;
                            return callback();
                        }
                        compileLevel (
                            path + '/' + key + '/' + propKeys[propKeysI],
                            subsublevel,
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

                compileLevel (
                    isObj ? path + '/' + keys[sublevelI] : path,
                    sublevel,
                    function (err, compiledSublevel) {
                        if (err) return callback (err);
                        compilation[sublevelI] = compiledSublevel;
                        callback();
                    }
                );
            }

            if (!(level instanceof Array)) {
                isObj = true;

                // reference?
                if (
                    level
                 && typeof level == 'object'
                 && Object.hasOwnProperty.call (level, '$ref')
                ) {
                    var refPath = url.parse (level.$ref);
                    var parentHash = parent.hash || '#';
                    var fullRef =
                        ( refPath.protocol || parent.protocol || 'https:' ) + '//'
                      + ( refPath.host || parent.host )
                      + ( refPath.path || parent.path )
                      + ( refPath.hash || '' )
                      ;

                    if (Object.hasOwnProperty.call (replacements, fullRef)) {
                        return process.nextTick (function(){
                            callback (undefined, { $ref:replacements[fullRef] });
                        });
                    }
                    replacements[fullRef] = path;

                    // is it a recursive reference?
                    var pseudoParent;
                    var replacePath =
                        ( ( parent.protocol || 'https:' ) + '//' )
                      + parent.host
                      + parent.path
                      // + parentHash
                      + refPath.hash
                      ;
                    if (
                        ( !refPath.host || parent && refPath.host == parent.host )
                     && ( !refPath.path || parent && refPath.path == parent.path )
                    ) {
                        // it's local, but is it recursive?
                        var idInfo = url.parse (id);
                        var realIDInfo = url.parse (id + path);
                        if (
                            realIDInfo.hash.slice (0, refPath.hash.length) == refPath.hash
                         // do not select ancestors of `id` that are not ancestors of `parent`
                         && (
                                refPath.hash.slice (0, idInfo.hash.length) == idInfo.hash
                             || parentHash.slice (0, refPath.hash.length) == refPath.hash
                         )
                        ) { // it's recursive!
                            // if (Object.hasOwnProperty.call (replacements, level.$ref))
                            var idHash = idInfo.hash || '#';
                            var modifiedPath = refPath.href.replace (idHash, replacePath);
                            modifiedPath = replacements[fullRef] = url.parse (modifiedPath).hash;
                            return callback (undefined, { $ref:modifiedPath });
                        }
                        pseudoParent = {
                            protocol:   parent.protocol || refPath.protocol || 'https:',
                            host:       parent.host || refPath.host,
                            path:       parent.path || refPath.path,
                            hash:       parent.hash ? (parent.hash + path.slice (1)) : path
                        };
                    } else {
                        pseudoParent = {
                            protocol:   refPath.protocol || parent.protocol || 'https:',
                            host:       refPath.host,
                            path:       refPath.path,
                            hash:       '#'
                        };
                    }

                    // resolve reference
                    if (pseudoParent.path[0] != '/')
                        pseudoParent.path = '/' + pseudoParent.path;
                    pseudoParent.href =
                        pseudoParent.protocol
                      + '//'
                      + pseudoParent.host
                      + pseudoParent.path
                      + pseudoParent.hash
                      ;
                    return self.resolveCompiled (path, pseudoParent, level.$ref, function (err, resolved) {
                        if (err) return callback (err);
                        keys = [];
                        var allKeys = Object.keys (level);
                        iter = [];
                        for (var i=0,j=allKeys.length; i<j; i++) {
                            var key = allKeys[i];
                            if (
                                Object.hasOwnProperty.call (metaschema.properties, key)
                             && key != 'definitions'
                            ) {
                                iter.push (level[key])
                                keys.push (key);
                            }
                        }
                        async.timesSeries (iter.length, compileIterSublevel, function (err) {
                            if (err) return callback (err);
                            var output = {};
                            for (var i=0,j=compilation.length; i<j; i++) {
                                var key = keys[i];
                                if (key != '$ref')
                                    output[key] = compilation[i];
                            }

                            // merge resolved schema and local compilation
                            callback (undefined, merge (metaschema, resolved, output, true));
                        });
                    }, replacements);
                }

                keys = [];
                iter = [];
                if (level && typeof level == 'object') {
                    var allKeys = Object.keys (level);
                    for (var i=0,j=allKeys.length; i<j; i++) {
                        var key = allKeys[i];
                        if (
                            Object.hasOwnProperty.call (metaschema.properties, key)
                         && key != 'definitions'
                        ) {
                            iter.push (level[key])
                            keys.push (key);
                        }
                    }
                }
            }

            async.timesSeries (iter.length, compileIterSublevel, function (err) {
                if (err) return callback (err);
                if (!isObj)
                    return callback (undefined, compilation);

                var output = {};
                for (var i=0,j=compilation.length; i<j; i++)
                    output[keys[i]] = compilation[i];
                callback (undefined, output);
            });
        }


        compileLevel (mount, schema, function (err, compiledSchema) {
            if (err) return callback (err);
            callback (err, compiledSchema, metaschema);
        });
    });
};
