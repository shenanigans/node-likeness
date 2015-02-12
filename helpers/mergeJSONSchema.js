
function merge (metaschema, able, baker) {
    if (baker instanceof Array) {
        var output = [];
        if (!(able instanceof Array)) {
            output.push.apply (output, baker);
            return output;
        }

        output.push.apply (output, able);
        for (var i=0,j=baker.length; i<j; i++) {
            var newVal = baker[i];
            var oldVal = output[i];

            // overwrite, merge further, etc....... KEYWORD
        }
        return output;
    }

    var output = {};
    // shallow clone able
    for (var key in able)
        if (Object.hasOwnProperty.call (metaschema.properties, key))
            output[key] = able[key];

    // overwrite or recurse
    for (var key in baker) {
        var val = baker[key];
        var valType = typeof val;

        if (key == 'type') {
            /* requires extra-special handling
             1. not defined in source - overwrite
             2. two strings - string or array if not equal
             3. string and array - append if unique
             4. array and array - union
            */
            if (!Object.hasOwnProperty.call (output, 'type')) {
                output.type = val;
                continue;
            }

            var typeNames = {};
            if (typeof output.type == 'string')
                typeNames[output.type] = true;
            else for (var i=0,j=output.type.length; i<j; i++)
                typeNames[output.type[i]] = true;
            if (typeof val == 'string')
                typeNames[val] = true;
            else for (var i=0,j=val.length; i<j; i++)
                typeNames[val[i]] = true;

            typeNames = Object.keys (typeNames);
            if (typeNames.length == 1)
                output.type = typeNames[0];
            else
                output.type = typeNames;
            continue;
        }

        if (
            !Object.hasOwnProperty.call (output, key)
         || valType != 'object'
         || typeof output[key] != 'object'
        ) {
            if (Object.hasOwnProperty.call (metaschema.properties, key))
                output[key] = val;
            continue;
        }

        var target = output[key];

        if (key == 'properties' || key == 'patternProperties') {
            // because of these special case keys, we must iterate properties and regex properties
            // in a way that does not test for special keys
            for (var subkey in val)
                if (Object.hasOwnProperty.call (target, subkey))
                    target[subkey] = merge (metaschema, target[subkey], val[subkey]);
                else
                    target[subkey] = val[subkey];
            continue;
        }

        if (key == 'dependencies') {
            /* three possibilities can occur
             1. Keys depend on keys in able and baker. Union dependencies.
             2. Schemata depend on keys in able and baker. Merge dependencies.
             3. Keys and Schemata depend on keys in able and baker. Create a dependent schema
                which adds key dependencies.
            */
            var aKeys = Object.keys (target);
            var bKeys = Object.keys (val);
            if (!aKeys.length || !bKeys.length)
                continue;

            var aDepKeys = Boolean (typeof target[aKeys[0]] == 'string');
            var bDepKeys = Boolean (typeof target[bKeys[0]] == 'string');

            if (aDepKeys && bDepKeys) {
                // union
                for (var key in target) {
                    var keyDeps = {};
                    var subtarget = target[key];
                    for (var i=0,j=subtarget[key].length; i<j; i++)
                        keyDeps[subtarget[i]] = true;
                    for (var i=0,j=val.length; i<j; i++)
                        keyDeps[val[i]] = true;
                    target[key] = Object.keys (keyDeps);
                }
                continue;
            }

            if (!aDepKeys && !bDepKeys) {
                output[key] = merge (metaschema, target, val);
                continue;
            }

            // create a new dependent schema to require gathered keys
            // collect existing key and schema dependencies
            var keyDeps = {};
            var schemaDeps = {};
            for (var key in target) {
                var subtarget = target[key];
                if (aDepKeys)
                    for (var i=0,j=subtarget.length; i<j; i++)
                        keyDeps[subtarget[i]] = true;
                else
                    schemaDeps[key] = subtarget;
            }
            for (var key in val) {
                if (bDepKeys)
                    for (var i=0,j=val.length; i<j; i++)
                        keyDeps[val[i]] = true;
                else
                    schemaDeps[key] = val[key];
            }
            // create a new dependent schema for each list of dependent keys
            for (var key in keyDeps) {
                var newSubelem = {};
                newSubelem[key] = keyDeps[key];
                newSubelem = { dependencies:newSubelem };
                if (!Object.hasOwnProperty.call (schemaDeps, key))
                    schemaDeps[key] = newSubelem;
                else
                    schemaDeps[key] = merge (metaschema, schemaDeps[key], newSubelem);
            }
            // dependencies are schemata from now on
            output.dependencies = schemaDeps;
            continue;
        }

        // keys that just need a simple recurse
        if (Object.hasOwnProperty.call (metaschema.properties, key))
            output[key] = merge (metaschema, target, val);
    }

    return output;
}

module.exports = merge;
