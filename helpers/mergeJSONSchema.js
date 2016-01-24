
/**     @property/Function likeness.helpers.mergeJSONSchema
    Produce one JSON Schema document from two that represents either an inheritence merge or the
    result of applying both of two schemata to the target. The Boolean flag argument `asInheritence`\
    determines which operation to perform.
@argument/Object metaschema
@argument/Object able
@argument/Object baker
@argument/Boolean asInheritence
    When true, conflicting constraints in `baker` will override those in `able`. When false,
    conflicting constraints apply together. This may produce a schema which cannot be satisfied.
*/
function merge (metaschema, able, baker, asInheritence) {
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
        var target = output[key];

        if (key == 'type') {
            /* requires extra-special handling
             1. not defined in source - overwrite
             2. two strings - string or Error if not equal
             3. string and array - string if found in array, else Error
             4. array and array - intersect, string if length one, Error if length zero
            OR:
             2a. with asInheritence=true: always union all types to string or array
            */
            if (!Object.hasOwnProperty.call (output, 'type')) {
                output.type = val;
                continue;
            }

            if (asInheritence) {
                var allTypes = {};

                if (typeof target == 'string')
                    allTypes[target] = true;
                else
                    for (var i=0,j=target.length; i<j; i++)
                        allTypes[target[i]] = true;

                if (valType == 'string')
                    allTypes[val] = true;
                else
                    for (var i=0,j=val.length; i<j; i++)
                        allTypes[val[i]] = true;

                allTypes = Object.keys (allTypes);
                if (allTypes.length == 1)
                    output.type = allTypes[0];
                else
                    output.type = allTypes;
                continue;
            }

            var typeNames = {};
            if (typeof output.type == 'string')
                typeNames[output.type] = true;
            else for (var i=0,j=output.type.length; i<j; i++)
                typeNames[output.type[i]] = true;

            if (typeof val == 'string') {
                if (!Object.hasOwnProperty.call (typeNames, val))
                    throw new Error ('merged schema is always invalid - selects incompatible types');
                output.type = val;
                continue;
            } else {
                var finalTypes = [];
                for (var i=0,j=val.length; i<j; i++)
                    if (Object.hasOwnProperty.call (typeNames, val[i]))
                        finalTypes.push (val[i]);
                if (!finalTypes.length)
                    throw new Error ('merged schema is always invalid - selects incompatible types');
                if (finalTypes.length == 1)
                    output.type = finalTypes[0];
                else
                    output.type = finalTypes;
                continue;
            }

            throw new Error ('invalid type specification');
        }

        if (key == 'additionalProperties') {
            if (typeof target == 'boolean') {
                if (!target && !asInheritence)
                    output.additionalProperties = false;
                else
                    output.additionalProperties = val;
                continue;
            }
            if (typeof val == 'boolean') {
                if (!val)
                    output.additionalProperties = false;
                else
                    output.additionalProperties = output.additionalProperties || true;
                continue;
            }
        }

        if (key == 'items') {
            var isTargetArr = target instanceof Array;
            var isValArr = val instanceof Array;
            if (!isTargetArr && !isValArr) {
                output.items = merge (metaschema, target, val, asInheritence);
                continue;
            }

            var newSequence = [];
            if (isTargetArr && !isValArr) {
                for (var i=0,j=target.length; i<j; i++)
                    newSequence[i] = merge (metaschema, target[i], val, asInheritence);
                output.items = newSequence;
                continue;
            }

            if (!isTargetArr && isValArr) {
                for (var i=0,j=val.length; i<j; i++)
                    newSequence[i] = merge (metaschema, target, val[i], asInheritence);
                output.items = newSequence;
                continue;
            }

            // both arrs
            if (
                ( target.length < val.length && !able.additionalItems )
             || ( target.length > val.length && !baker.additionalItems )
            )
                throw new Error (
                    'merged schema is always invalid - "items" sequences of unequal length'
                );

            for (var i=0,j=Math.max (target.length, val.length); i<j; i++) {
                var subtarget = i < target.length ? target[i] : able.additionalItems;
                var subval = i < val.length ? val[i] : baker.additionalItems;
                newSequence[i] = merge (metaschema, subtarget, subval, asInheritence);
            }
            output.items = newSequence;

            continue;
        }

        if (key == 'properties' || key == 'patternProperties') {
            var finalProps = {};
            if (!asInheritence) {
                if (able.additionalProperties === false) {
                    for (var subkey in val)
                        if (Object.hasOwnProperty.call (target, subkey))
                            finalProps[subkey] = merge (metaschema, target[subkey], val[subkey]);
                } else if (typeof able.additionalProperties == 'object') {
                    for (var subkey in val)
                        if (Object.hasOwnProperty.call (target, subkey))
                            finalProps[subkey] = merge (metaschema, target[subkey], val[subkey]);
                        else
                            finalProps[subkey] = merge (
                                metaschema,
                                able.additionalProperties,
                                val[subkey]
                            );
                } else {
                    for (var subkey in val)
                        if (Object.hasOwnProperty.call (target, subkey))
                            finalProps[subkey] = merge (metaschema, target[subkey], val[subkey]);
                        else
                            finalProps[subkey] = val[subkey];
                }

                for (var subkey in target)
                    if (!Object.hasOwnProperty.call (finalProps, subkey))
                        finalProps[subkey] = target[subkey];
                output[key] = finalProps;
                continue;
            }

            for (var subkey in val)
                if (Object.hasOwnProperty.call (target, subkey))
                    target[subkey] = merge (metaschema, target[subkey], val[subkey], asInheritence);
                else
                    target[subkey] = val[subkey];
            continue;
        }

        if (!Object.hasOwnProperty.call (output, key)) {
            if (Object.hasOwnProperty.call (metaschema.properties, key))
                output[key] = val;
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

            var aDepKeys = Boolean (target[aKeys[0]] instanceof Array);
            var bDepKeys = Boolean (val[bKeys[0]] instanceof Array);

            if (aDepKeys && bDepKeys) {
                // union
                var finalDeps = {};

                var targetKeys = Object.keys (target);
                for (var i=0,j=targetKeys.length; i<j; i++)
                    finalDeps[targetKeys[i]] = true; // always writes a new Array, never pushes
                var valKeys = Object.keys (val);
                for (var i=0,j=valKeys.length; i<j; i++)
                    if (!Object.hasOwnProperty.call (finalDeps, valKeys[i]))
                        finalDeps[valKeys[i]] = true; // always writes a new Array, never pushes

                for (var subkey in finalDeps) {
                    if (!Object.hasOwnProperty.call (target, subkey)) {
                        finalDeps[subkey] = val[subkey];
                        continue;
                    }
                    if (!Object.hasOwnProperty.call (val, subkey)) {
                        finalDeps[subkey] = target[subkey];
                        continue;
                    }
                    var keyDeps = {};
                    for (var i=0,j=target[subkey].length; i<j; i++)
                        keyDeps[target[subkey][i]] = true;
                    for (var i=0,j=val[subkey].length; i<j; i++)
                        keyDeps[val[subkey][i]] = true;
                    finalDeps[subkey] = Object.keys (keyDeps);
                }
                output.dependencies = finalDeps;
                continue;
            }

            if (!aDepKeys && !bDepKeys) {
                var merged = {};
                var targetKeys = Object.keys (target);
                for (var i=0,j=targetKeys.length; i<j; i++)
                    if (!Object.hasOwnProperty.call (val, targetKeys[i]))
                        merged[targetKeys[i]] = target[targetKeys[i]];
                    else
                        merged[targetKeys[i]] = merge (
                            metaschema,
                            target[targetKeys[i]],
                            val[targetKeys[i]],
                            asInheritence
                        );
                var valKeys = Object.keys (val);
                for (var i=0,j=valKeys.length; i<j; i++) {
                    var valKey = valKeys[i];
                    if (Object.hasOwnProperty.call (merged, valKey))
                        continue;
                    if (!Object.hasOwnProperty.call (target, valKey))
                        merged[valKey] = val[valKey];
                    else
                        merged[valKey] = merge (
                            metaschema,
                            target[valKey],
                            val[valKey],
                            asInheritence
                        );
                }

                output.dependencies = merged;
                continue;
            }

            // create a new dependent schema to require gathered keys
            // collect existing key and schema dependencies
            var keyDeps = {};
            var schemaDeps = {};
            var allKeys = {};
            for (var subkey in target) {
                allKeys[subkey] = true;
                if (aDepKeys)
                    keyDeps[subkey] = target[subkey];
                else
                    schemaDeps[subkey] = target[subkey];
            }
            for (var subkey in val) {
                allKeys[subkey] = true;
                if (bDepKeys)
                    keyDeps[subkey] = val[subkey];
                else
                    schemaDeps[subkey] = val[subkey];
            }

            for (var subkey in allKeys) {
                if (!Object.hasOwnProperty.call (keyDeps, subkey)) {
                    continue;
                }

                var newSubschema = { required:keyDeps[subkey] };
                if (!Object.hasOwnProperty.call (schemaDeps, subkey)) {
                    schemaDeps[subkey] = newSubschema;
                    continue;
                }

                schemaDeps[subkey] = merge (
                    metaschema,
                    schemaDeps[subkey],
                    newSubschema,
                    asInheritence
                );
            }
            output.dependencies = schemaDeps;
            continue;
        }

        if (key == 'required') {
            // union
            var required = {};
            for (var i=0,j=target.length; i<j; i++)
                required[target[i]] = true;
            for (var i=0,j=val.length; i<j; i++)
                required[val[i]] = true;
            output.required = Object.keys (required);
            continue;
        }

        if (key == 'properties') {
            if (typeof target == 'boolean')
                if (typeof val == 'boolean') // both bools
                    output.items = target && val;
                else { // target is bool, val is arr
                    output.items = val;
                    if (!target && !asInheritence)
                        throw new Error (
                            'merged schema is always invalid - "items" both sequence and false'
                        );
                }
            else // target is arr
                if (typeof val == 'boolean') // target is arr, val is bool
                    if (!val)
                        output.items = false;
                    else
                        output.items = target;
                else {// both arrs
                    if (
                        ( target.length < val.length && !able.additionalItems )
                     || ( target.length > val.length && !baker.additionalItems )
                    )
                        throw new Error (
                            'merged schema is always invalid - "items" sequences of unequal length'
                        );

                    var newSequence = [];
                    for (var i=0,j=Math.max (target.length, val.length); i<j; i++) {
                        var subtarget = i < target.length ? target[i] : able.additionalItems;
                        var subval = i < val.length ? val[i] : baker.additionalItems;
                        newSequence[i] = merge (metaschema, subtarget, subval, asInheritence);
                    }
                    output.items = newSequence;
                }

            continue;
        }

        if (
            valType != 'object'
         || typeof output[key] != 'object'
        ) {
            if (Object.hasOwnProperty.call (metaschema.properties, key))
                output[key] = val;
            continue;
        }

        // keys that just need a simple recurse
        if (Object.hasOwnProperty.call (metaschema.properties, subkey))
            output[subkey] = merge (metaschema, target, val, asInheritence);
    }

    return output;
}

module.exports = merge;
