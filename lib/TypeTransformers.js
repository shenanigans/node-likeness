
var async = require ('async');
var getTypeStr = require ('./GetTypeStr');
var TransformError = require ('./errors').TransformError;
var Set = require ('./Set');

var RE_VALID_NUMBER = /^\s*\d+(?:\.\d+)?\s*$/;

function merge (source, target, mongoloid, path) {
    var valtype = getTypeStr (source);
    if (valtype == 'object')
        return simpleMerge (source, target || {}, mongoloid, path);
    if (valtype == 'array')
        return simpleArrayMerge (source, target || [], mongoloid, path);
    return source;
}

function simpleMerge (source, target, mongoloid, path) {
    var output = {};
    for (var key in target)
        output[key] = target[key];

    var didSomething = false;
    for (var key in source) {
        var val = source[key];
        var subpath = path ? path+'.'+key : undefined;

        if (!Object.hasOwnProperty.call (target, key)) {
            if (getTypeStr (val) == 'object') {
                var newChild = simpleMerge (val, {}, mongoloid, subpath);
                if (newChild !== undefined) {
                    if (mongoloid) {
                        if (!mongoloid.$set)
                            mongoloid.$set = {};
                        mongoloid.$set[subpath] = val;
                    }
                    output[key] = newChild;
                    didSomething = true;
                }
                continue;
            }
            if (getTypeStr (val) == 'array') {
                var newChild = simpleArrayMerge (val, [], mongoloid, subpath);
                if (newChild !== undefined) {
                    if (mongoloid) {
                        if (!mongoloid.$set)
                            mongoloid.$set = {};
                        mongoloid.$set[subpath] = val;
                    }
                    output[key] = newChild;
                    didSomething = true;
                }
                continue;
            }

            didSomething = true;
            output[key] = val;
            if (mongoloid) {
                if (!mongoloid.$set)
                    mongoloid.$set = {};
                mongoloid.$set[subpath] = val;
            }
            continue;
        }

        var childType = getTypeStr (val);
        if (childType == 'object') {
            var newChild = simpleMerge (val, target[key] || {}, mongoloid, subpath);
            if (newChild !== undefined) {
                didSomething = true;
                output[key] = newChild;
            }
            continue;
        }
        if (childType == 'array') {
            var newChild = simpleArrayMerge (val, target[key] || [], mongoloid, subpath);
            if (newChild !== undefined) {
                didSomething = true;
                output[key] = newChild;
            }
            continue;
        } else {
            didSomething = true;
            output[key] = val;
        }
    }

    return didSomething ? output : undefined;
}

function simpleArrayMerge (source, target, mongoloid, path) {
    if (!source.length)
        return;

    var output = [];
    output.push.apply (output, target);

    for (var i=0,j=source.length; i<j; i++) {
        var val = source[i];
        var subpath = path ? path+'.'+i : undefined;

        if (i >= target.length) {
            output.push (val);
            if (mongoloid) {
                if (!mongoloid.$set)
                    mongoloid.$set = {};
                mongoloid.$set[subpath] = val;
            }
            continue;
        }

        var childType = getTypeStr (val);
        var tval = target[i];
        var tvalType = getTypeStr (tval);
        var nextVal;

        if (childType == 'object')
            nextVal = simpleMerge (val, tval || {}, mongoloid, subpath);
        else if (childType == 'array')
            nextVal = simpleArrayMerge (val, tval || [], mongoloid, subpath);
        else
            nextVal = val;

        if (i < target.length) {
            output[i] = nextVal;
            continue;
        }

        output.push (val);
        if (mongoloid) {
            if (!mongoloid.$set)
                mongoloid.$set = {};
            mongoloid.$set[subpath] = val;
        }
    }

    return output;
}

var TYPE_TRANSFORMERS = {
    object:     function (value, target, mongoloid, callback, path) {
        path = path || this.path;
        if (typeof value == 'string') {
            try {
                value = JSON.parse (value);
            } catch (err) {
                throw new TransformError (
                    'FORMAT',
                    value,
                    path,
                    'failed to cast String to Object'
                );
            }
            if (getTypeStr (value) != 'object')
                throw new TransformError (
                    'FORMAT',
                    value,
                    path,
                    'failed to cast String to Object'
                );
        }

        if (this.constraints.inject) {
            // shallow copy value
            var newValue = {};
            for (var key in value) newValue[key] = value[key];
            value = newValue;

            for (var i in this.constraints.inject) {
                var injection = this.constraints.inject[i];
                value[injection[0]] = injection[1];
            }
        }

        // clone the target
        var newTarget = {};
        var targetKeys = Object.keys (target);
        var targetLen = targetKeys.length;
        for (var i=0,j=targetKeys.length; i<j; i++)
            newTarget[targetKeys[i]] = target[targetKeys[i]];
        target = newTarget;

        var uniqueSet;
        if (this.constraints.unique)
            uniqueSet = new Set();

        // clone .exists, so we can sweep it as we go
        var exists, existsLives;
        if (this.constraints.exists) {
            exists = [];
            existsLives = [];
            for (var i=0,j=this.constraints.exists.length; i<j; i++) {
                exists.push (this.constraints.exists[i]);
                existsLives.push (this.constraints.exists[i].constraints.times || 1);
            }
        }

        // children - async
        // ====================================================================
        if (callback) {
            var self = this;

            var keys = Object.keys (value);
            var rename = this.constraints.rename;
            var drop = this.constraints.drop;
            return async.each (keys, function (name, callback) {
                // .rename
                var newValue = value[name];
                var subpath = path ? path + '.' + name : name;

                if (rename && Object.hasOwnProperty.call (rename, name))
                    name = rename[name];
                // .drop
                if (drop && Object.hasOwnProperty.call (drop, name))
                    return callback();

                // child processing
                function finalValidation (err, newValue) {
                    if (err) return callback (err);

                    if (uniqueSet && !uniqueSet.add (newValue))
                        return callback (new TransformError (
                            'ILLEGAL',
                            true,
                            newValue,
                            path || self.path,
                            'duplicate property'
                        ));

                    // .filter
                    if (self.constraints.filter)
                        return self.constraints.filter.validate (
                            newValue,
                            function (err) {
                                if (err)
                                    return callback(); // .filter drops quietly
                                target[name] = newValue;
                                if (!Object.hasOwnProperty.call (target, name)) {
                                    if (targetLen) targetLen++;
                                    if (mongoloid) {
                                        if (!mongoloid.$set)
                                            mongoloid.$set = {};
                                        mongoloid.$set[subpath] = newValue;
                                    }
                                }
                                callback();
                            }
                        );

                    // .exists
                    if (exists && exists.length)
                        return async.times (exists.length, function (existsI, callback) {
                            if (!existsLives[existsI])
                                return callback();

                            exists[existsI].validate (newValue, function (err) {
                                if (err) return callback();
                                if (!--existsLives[existsI]) {
                                    delete exists[existsI];
                                    delete existsLives[existsI];
                                }
                                callback();
                            });
                        }, function(){
                            if (!Object.hasOwnProperty.call (target, name)) {
                                if (targetLen) targetLen++;
                                if (mongoloid) {
                                    if (!mongoloid.$set)
                                        mongoloid.$set = {};
                                    mongoloid.$set[subpath] = newValue;
                                }
                            }
                            target[name] = newValue;
                            callback();
                        });

                    if (!Object.hasOwnProperty.call (target, name)) {
                        if (targetLen) targetLen++;
                        if (mongoloid) {
                            if (!mongoloid.$set)
                                mongoloid.$set = {};
                            mongoloid.$set[subpath] = newValue;
                        }
                    }
                    target[name] = newValue;
                    callback();
                }

                var subpath = path ? path + '.' + name : name;
                var childSchema = undefined;
                if (Object.hasOwnProperty.call (self.children, name))
                    childSchema = self.children[name];
                else if (self.constraints.matchChildren)
                    for (var i=0,j=self.constraints.matchChildren.length; i<j; i++)
                        if (self.constraints.matchChildren[i].pattern.test (name)) {
                            childSchema = self.constraints.matchChildren[i];
                            break;
                        }

                if (childSchema) {
                    // known key
                    if (self.constraints.all) return self.constraints.all.transform (
                        newValue,
                        target[name],
                        mongoloid,
                        function (err, nextValue) {
                            if (err)
                                return callback (new TransformError (
                                    'INVALID',
                                    value,
                                    path,
                                    'source value failed .all validation',
                                    err
                                ));

                            childSchema.transform (
                                newValue,
                                nextValue,
                                mongoloid,
                                finalValidation,
                                subpath
                            );
                        }
                    );

                    // no .all
                    return childSchema.transform (
                        newValue,
                        target[name],
                        mongoloid,
                        finalValidation,
                        subpath
                    );
                }

                // unknown key
                if (self.constraints.keyTest)
                    return self.constraints.keyTest.validate (name, function (err) {
                        if (err) {
                            return callback (new TransformError (
                                'ILLEGAL',
                                value,
                                subpath,
                                'source key rejected by .keyTest',
                                err
                            ));
                        }

                        // .all
                        if (self.constraints.all)
                            return self.constraints.all.transform (
                                newValue,
                                target[name],
                                mongoloid,
                                function (err, nextValue) {
                                    if (err)
                                        return callback (new TransformError (
                                            'INVALID',
                                            value,
                                            path,
                                            'source value failed .all validation',
                                            err
                                        ));
                                    finalValidation (undefined, nextValue);
                                },
                                subpath
                            );

                        // NOTICE finalValidation won't be called from here on
                        if (uniqueSet && !uniqueSet.add (newValue))
                            return callback (new TransformError (
                                'ILLEGAL',
                                true,
                                newValue,
                                path || self.path,
                                'duplicate property'
                            ));

                        // .filter
                        if (self.constraints.filter)
                            return self.constraints.filter.validate (
                                newValue,
                                function (err) {
                                    if (err) return callback (err);

                                    if (mongoloid) {
                                        if (!mongoloid.$set)
                                            mongoloid.$set = {};
                                        mongoloid.$set[subpath] = newValue;
                                    }

                                    if (Object.hasOwnProperty.call (target, name)) {
                                        target[name] = merge (
                                            newValue,
                                            target[name],
                                            mongoloid,
                                            subpath
                                        );
                                        return callback();
                                    }

                                    targetLen++;
                                    target[name] = newValue;
                                    callback();
                                }
                            );

                        if (Object.hasOwnProperty.call (target, name)) {
                            target[name] = merge (newValue, target[name], mongoloid, subpath);
                            return callback();
                        }

                        targetLen++;
                        if (getTypeStr (newValue) == 'object') {
                            var newDoc = target[name] = {};
                            target[name] = merge (
                                newValue,
                                newDoc,
                                mongoloid,
                                path ? path + '.' + name : name
                            );
                            return callback();
                        }

                        if (!Object.hasOwnProperty.call (target, name)) {
                            if (targetLen) targetLen++;
                            if (mongoloid) {
                                if (!mongoloid.$set)
                                    mongoloid.$set = {};
                                mongoloid.$set[subpath] = newValue;
                            }
                        }
                        target[name] = newValue;
                        callback();
                    });

                if (!self.constraints.adHoc)
                    if (self.constraints.tolerant)
                        return callback();
                    else {
                        return callback (new TransformError (
                            'ILLEGAL',
                            value,
                            subpath,
                            'found unknown key'
                        ));
                    }

                // .all
                if (self.constraints.all)
                    return self.constraints.all.transform (
                        newValue,
                        target[name],
                        mongoloid,
                        function (err, nextValue) {
                            if (err)
                                return callback (new TransformError (
                                    'INVALID',
                                    value,
                                    subpath,
                                    'source value failed .all validation',
                                    err
                                ));
                            finalValidation (undefined, nextValue);
                        },
                        subpath
                    );

                // NOTICE finalValidation won't be called from here on
                if (uniqueSet && !uniqueSet.add (newValue))
                    return callback (new TransformError (
                        'ILLEGAL',
                        true,
                        newValue,
                        path || self.path,
                        'duplicate property'
                    ));

                // .filter
                if (self.constraints.filter)
                    return self.constraints.filter.validate (
                        newValue,
                        function (err) {
                            if (err) return callback (err);

                            if (mongoloid) {
                                if (!mongoloid.$set)
                                    mongoloid.$set = {};
                                mongoloid.$set[subpath] = newValue;
                            }

                            if (Object.hasOwnProperty.call (target, name)) {
                                target[name] = merge (newValue, target[name], mongoloid, subpath);
                                return callback();
                            }

                            targetLen++;
                            target[name] = newValue;
                            callback();
                        }
                    );

                if (Object.hasOwnProperty.call (target, name)) {
                    target[name] = merge (newValue, target[name], mongoloid, subpath);
                    return callback();
                }

                targetLen++;
                if (getTypeStr (newValue) == 'object') {
                    var newDoc = target[name] = {};
                    target[name] = merge (
                        newValue,
                        newDoc,
                        mongoloid,
                        path ? path + '.' + name : name
                    );
                    return callback();
                }

                if (mongoloid) {
                    if (!mongoloid.$set)
                        mongoloid.$set = {};
                    mongoloid.$set[subpath] = newValue;
                }
                target[name] = newValue;
                callback();
            }, function (err) {
                // async children final wrapup
                if (err) return callback (err);

                // .exists
                if (exists) {
                    exists = exists.filter (Boolean);
                    existsLives = existsLives.filter (Boolean);
                    if (exists.length) // unresolved .exists
                        return callback (new TransformError (
                            'MISSING',
                            exists,
                            value,
                            path || self.path,
                            'could not resolve a .exists constraint'
                        ));
                }

                // .clip
                if (self.constraints.clip) {
                    var clip = self.constraints.clip;
                    var keys = Object.keys (target);
                    var dropKeys;
                    if (clip >= 0)
                        dropKeys = keys.slice (0, Math.max (0, keys.length - clip))
                    else
                        dropKeys = keys.slice (clip * -1);
                    for (var i in dropKeys)
                        delete target[dropKeys[i]];
                }

                // .max
                if (self.constraints.max !== undefined && self.constraints.max < targetLen)
                    return callback (new TransformError (
                        'LIMIT',
                        value,
                        subpath,
                        'too many keys on object'
                    ));

                // .min
                if (self.constraints.min !== undefined && self.constraints.min > targetLen)
                    return callback (new TransformError (
                        'LIMIT',
                        value,
                        subpath,
                        'too few keys on object'
                    ));

                // .length
                if (self.constraints.length !== undefined && self.constraints.length != targetLen)
                    return callback (new TransformError (
                        'LIMIT',
                        value,
                        subpath,
                        'wrong number of keys on object'
                    ));

                // any missing mandatory keys?
                for (var key in self.children)
                    if (
                        !self.children[key].constraints.optional
                     && !Object.hasOwnProperty.call (target, key)
                    )
                        return callback (new TransformError (
                            'MISSING',
                            undefined,
                            value,
                            subpath,
                            'final Object is incomplete'
                        ));

                callback (undefined, target);
            });
        }


        // children - sync
        // ====================================================================
        // .insert
        // if (this.constraints.insert) {
        //     // step into the new child key
        //     var newValue;
        //     var fullpath = path ?
        //         path + '.' + this.constraints
        //       : this.constraints
        //       ;

        //     // does the insertion key have a schema?
        //     if (Object.hasOwnProperty.call (this.children, this.constraints.insert)) {
        //         var childSchema = this.children[this.constraints.insert];
        //         // insertion key exists on target?
        //         if (Object.hasOwnProperty.call (target, this.constraints.insert))
        //             newValue = childSchema.transform (
        //                 value,
        //                 target[this.constraints.insert],
        //                 mongoloid,
        //                 undefined,
        //                 fullpath
        //             );
        //         else {
        //             newValue = childSchema.transform (
        //                 value,
        //                 target[this.constraints.insert] = {},
        //                 mongoloid,
        //                 undefined,
        //                 fullpath
        //             );
        //             target[this.constraints.insert] = newValue;
        //             if (mongoloid) {
        //                 if (!mongoloid.$set)
        //                     mongoloid.$set = {};
        //                 mongoloid.$set[fullpath] = newValue;
        //             }
        //         }
        //     } else {
        //         if (
        //             !Object.hasOwnProperty.call (target, this.constraints.insert)
        //          || getTypeStr (target[this.constraints.insert]) != 'object'
        //         )
        //             newValue = value;
        //         else
        //             newValue = merge (
                    //     value, target[this.constraints.insert], mongoloid, fullpath
                    // );
        //         target[this.constraints.insert] = newValue;
        //         if (mongoloid) {
        //             if (!mongoloid.$set)
        //                 mongoloid.$set = {};
        //             mongoloid.$set[fullpath] = newValue;
        //         }
        //     }
        //     return target;
        // }

        var rename = this.constraints.rename;
        var drop = this.constraints.drop;
        var names = Object.keys (value);
        for (var nameI=0,j=names.length; nameI<j; nameI++) {
            var name = names[nameI];
            // .rename
            var newValue = value[name];
            if (rename && Object.hasOwnProperty.call (rename, name))
                name = rename[name];
            // .drop
            if (drop && Object.hasOwnProperty.call (drop, name))
                continue;

            // child processing
            var subpath = path ? path + '.' + name : name;
            var childSchema = undefined;
            if (Object.hasOwnProperty.call (this.children, name))
                childSchema = this.children[name];
            else if (this.constraints.matchChildren)
                for (var k=0,l=this.constraints.matchChildren.length; k<l; k++)
                    if (this.constraints.matchChildren[k].pattern.test (name)) {
                        childSchema = this.constraints.matchChildren[k];
                        break;
                    }

            var nextValue = target[name];
            if (childSchema) {
                if (this.constraints.all) try {
                    nextValue = this.constraints.all.transform (
                        newValue,
                        nextValue,
                        mongoloid,
                        undefined,
                        subpath
                    );
                } catch (err) {
                    throw new TransformError (
                        'INVALID',
                        value,
                        subpath,
                        'result value failed .all validation',
                        err
                    );
                }
                // known key
                if (!Object.hasOwnProperty.call (target, name)) {
                    // key not found on target
                    // key count issues?
                    if (targetLen && this.constraints.max == targetLen && !this.constraints.clip)
                        throw new TransformError (
                            'LIMIT',
                            nextValue,
                            childSchema.path,
                            'new source key exceeds maximum key limit'
                        );
                }

                nextValue = childSchema.transform (newValue, nextValue, mongoloid);

                if (uniqueSet && !uniqueSet.add (nextValue))
                    throw new TransformError (
                        'ILLEGAL',
                        true,
                        nextValue,
                        path || this.path,
                        'duplicate property'
                    );

                // .filter
                if (this.constraints.filter)
                    try {
                        this.constraints.filter.validate (newValue);
                    } catch (err) { continue; /* it's ok, just drop it */ }

                if (exists && exists.length)
                    // .exists
                    for (var k=0,l=exists.length; k<l; k++)
                        try {
                            exists[k].validate (nextValue);
                            if (!--existsLives[k]) {
                                exists.splice (k, 1);
                                existsLives.splice (k, 1);
                                k--; l--;
                            }
                        } catch (err) { /* nobody cares */ }

                if (uniqueSet && !uniqueSet.add (nextValue))
                    throw new TransformError (
                        'ILLEGAL',
                        true,
                        nextValue,
                        path || this.path,
                        'duplicate property'
                    );

                target[name] = nextValue;
                if (targetLen) targetLen++;
                continue;
            }

            // unknown key
            if (!this.constraints.all)
                nextValue = newValue;
            else try {
                nextValue = this.constraints.all.transform (
                    newValue,
                    nextValue,
                    mongoloid,
                    undefined,
                    subpath
                );
            } catch (err) {
                throw new TransformError (
                    'INVALID',
                    value,
                    subpath,
                    'result value failed .all validation',
                    err
                );
            }

            // .keyTest
            if (this.constraints.keyTest)
                try {
                    this.constraints.keyTest.validate (name);
                } catch (err) {
                    throw new TransformError (
                        'ILLEGAL',
                        value,
                        subpath,
                        'source key rejected by .keyTest',
                        err
                    );
                }
            else if (!this.constraints.adHoc)
                if (this.constraints.tolerant)
                    continue;
                else {
                    throw new TransformError (
                        'ILLEGAL',
                        value,
                        subpath,
                        'found unknown key'
                    );
                }

            if (uniqueSet && !uniqueSet.add (nextValue))
                throw new TransformError (
                    'ILLEGAL',
                    true,
                    newValue,
                    path || this.path,
                    'duplicate property'
                );

            // .filter
            if (this.constraints.filter)
                try {
                    this.constraints.filter.validate (newValue);
                } catch (err) { continue; /* it's ok, just drop it */ }

            // .exists
            if (exists && exists.length)
                // .exists
                for (var k=0,l=exists.length; k<l; k++)
                    try {
                        exists[k].validate (nextValue);
                        if (!--existsLives[k]) {
                            exists.splice (k, 1);
                            existsLives.splice (k, 1);
                            k--; l--;
                        }
                    } catch (err) { /* nobody cares */ }

            if (Object.hasOwnProperty.call (target, name)) {
                nextValue = merge (
                    nextValue,
                    target[name],
                    mongoloid,
                    path ? path + '.' + name : name
                );
                target[name] = nextValue;
                continue;
            }

            if (targetLen) {
                if (targetLen == this.constraints.max && !this.constraints.clip) {
                    throw new TransformError (
                        'LIMIT',
                        value,
                        subpath,
                        'new source key exceeds maximum key limit'
                    );
                }
                targetLen++;
            }

            if (getTypeStr (nextValue) == 'object') {
                target[name] = merge (
                    nextValue,
                    {},
                    mongoloid,
                    path ? path + '.' + name : name
                );
                continue;
            }

            target[name] = nextValue;
            if (mongoloid) {
                if (!mongoloid.$set)
                    mongoloid.$set = {};
                mongoloid.$set[path ? path + name : name] = nextValue;
            }
        }

        // .clip
        if (this.constraints.clip) {
            var clip = this.constraints.clip;
            var keys = Object.keys (target);
            var dropKeys;
            if (clip >= 0)
                dropKeys = keys.slice (0, Math.max (0, keys.length - clip))
            else
                dropKeys = keys.slice (clip * -1);
            if (!mongoloid)
                for (var i in dropKeys)
                    delete target[dropKeys[i]];
            else {
                if (!mongoloid.$unset)
                    mongoloid.$unset = {};
                for (var i in dropKeys)
                    mongoloid.$unset[subpath] = true;
            }
        }

        // min
        if (this.constraints.min !== undefined && names.length < this.constraints.min)
            throw new TransformError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too few keys on Object'
            );

        // max
        if (this.constraints.max !== undefined && names.length > this.constraints.max)
            throw new TransformError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too many keys on Object'
            );

        // length
        if (this.constraints.length !== undefined && names.length != this.constraints.length)
            throw new TransformError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'wrong number of keys on Object'
            );

        // mandatory keys
        for (var key in this.children)
            if (
                !this.children[key].constraints.optional
             && !Object.hasOwnProperty.call (target, key)
            )
                throw new TransformError (
                    'MISSING',
                    undefined,
                    value,
                    this.path,
                    'final Object is incomplete'
                );

        // unresolved .exists
        if (exists && exists.length)
            throw new TransformError (
                'MISSING',
                undefined, // exists,
                undefined, // value,
                path || this.path,
                'could not resolve a .exists constraint'
            );

        return target;
    },
    array:      function (value, target, mongoloid, callback, path) {
        path = path || this.path;
        if (typeof value == 'string') {
            if (this.constraints.cast) {
                // cast
                try {
                    value = JSON.parse (value);
                } catch (err) {
                    throw new TransformError (
                        'FORMAT',
                        value,
                        path,
                        'failed to cast String to Array',
                        err
                    );
                }
                if (!(value instanceof Array))
                    throw new TransformError (
                        'FORMAT',
                        value,
                        path,
                        'failed to cast String to Array'
                    );
            } else if (this.constraints.group) {
                var output = [];
                var info;
                while (info = this.constraints.group.exec (value))
                    output.push.apply (output, info.slice (0));
                if (!output.length)
                    throw new TransformError (
                        'FORMAT',
                        value,
                        path,
                        'failed to match input string'
                    );
                value = output;
            } else { // split
                value = value.split (this.constraints.split);
            }
        }

        // .inject
        if (this.constraints.inject) {
            // shallow clone the value
            var newVal = [];
            newVal.push.apply (newVal, value);
            value = newVal;
            for (var i in this.constraints.inject) {
                var injection = this.constraints.inject[i];
                if (injection.length == 1)
                    value.push (injection[0]);
                else if (typeof injection[0] != 'number' || isNaN (injection[0]))
                    value.push (injection[1]);
                else
                    value.splice (injection[0], 0, injection[1]);
            }
        }

        // clone the target
        var newTarget = [];
        newTarget.push.apply (newTarget, target);
        target = newTarget;

        // .unique
        var uniqueSet;
        if (this.constraints.unique) {
            var localValue = [];
            uniqueSet = new Set (target);
            if (uniqueSet.count != target.length)
                target = uniqueSet.export();
            for (var i=0,j=value.length; i<j; i++)
                if (uniqueSet.add (value[i]))
                    localValue.push (value[i]);
            value = localValue;
        }

        // .max
        if (
            this.constraints.max
         && value.length + target.length > this.constraints.max
         && !this.constraints.clip
        )
            throw new TransformError (
                'LIMIT',
                value,
                path,
                'new Array data exceeds maximum length'
            );

        // clone .exists, so we can sweep it as we go
        var exists, existsLives;
        if (this.constraints.exists) {
            exists = [];
            existsLives = [];
            for (var i=0,j=this.constraints.exists.length; i<j; i++) {
                exists.push (this.constraints.exists[i]);
                existsLives.push (this.constraints.exists[i].constraints.times || 1);
            }
        }

        if (callback && ( this.constraints.all || this.constraints.sequence)) {
            var self = this;
            return async.times (value.length, function (subvalueI, callback) {
                var newValue = value[subvalueI];
                var nextValue = target[subvalueI];
                var jobs = [];
                if (self.constraints.all)
                    jobs.push (function (callback) {
                        self.constraints.all.transform (
                            newValue,
                            nextValue,
                            undefined,
                            function (err, setNextValue) {
                                if (err)
                                    return callback (new TransformError (
                                        'INVALID',
                                        value,
                                        path || self.path,
                                        'source value failed .all validation',
                                        err
                                    ));
                                nextValue = setNextValue;
                                callback();
                            }
                        );
                    });

                if (self.constraints.sequence && self.constraints.sequence.length > subvalueI)
                    jobs.push (function (callback) {
                        self.constraints.sequence[subvalueI].transform (
                            newValue,
                            nextValue,
                            undefined,
                            function (err, setNextValue) {
                                if (err)
                                    return callback (err);
                                nextValue = setNextValue;
                                callback();
                            },
                            (path || this.path) + '.' + subvalueI
                        );
                    });
                else if (self.constraints.extras)
                    jobs.push (function (callback) {
                        self.constraints.extras.transform (
                            newValue,
                            nextValue,
                            undefined,
                            function (err, setNextValue) {
                                if (err)
                                    return callback (new TransformError (
                                        'INVALID',
                                        value,
                                        path || self.path,
                                        'source value failed .extras validation',
                                        err
                                    ));
                                nextValue = setNextValue;
                                callback();
                            }
                        );
                    });
                else if (!self.constraints.all)
                    return callback (new TransformError (
                        'ILLEGAL',
                        undefined,
                        childValue,
                        self.path,
                        'found unexpected array item'
                    ));

                async.series (jobs, function (err) {
                    if (err) return callback (err);
                    target[subvalueI] = nextValue;
                    callback();
                });
            }, function (err) {
                if (err)
                    return callback (err);

                if (
                    !self.constraints.insert
                 && !self.constraints.append
                 && !self.constraints.prepend
                ) {
                    // overwrite target Array
                    if (!self.constraints.all && !self.constraints.sequence) {
                        target.splice (0, target.length); // drops all elements from target
                        target.push.apply (target, value);
                        if (self.constraints.clip)
                            if (self.constraints.clip >= 0)
                                target.splice (self.constraints.clip, target.length);
                            else
                                target.splice (0, Math.max (
                                    0,
                                    target.length + self.constraints.clip
                                ));
                    }

                    if (mongoloid) {
                        if (!mongoloid.$set)
                            mongoloid.$set = {};
                        mongoloid.$set[path] = target;
                    }

                    if (callback) return process.nextTick (function(){
                            callback (undefined, target);
                        });
                    return target;
                }

                if (exists)
                    return async.times (target.length, function (targetI, callback) {
                        async.times (exists.length, function (existsI, callback) {
                            if (!existsLives[existsI]) return callback();
                            exists[existsI].validate (nextValue, function (err) {
                                if (err) return callback();
                                if (!--existsLives[existsI]) {
                                    delete exists[existsI];
                                    delete existsLives[existsI];
                                }
                                callback();
                            });
                        }, callback);
                    }, function(){
                        if (exists.filter (Boolean).length)
                            return callback (new TransformError (
                                'MISSING',
                                undefined,
                                undefined,
                                path || this.path,
                                'could not resolve a .exists constraint'
                            ));
                        callback();
                    });

                var submongoloid; // if we write anything to the mongoloid
                                  // self passes it to .clip/.slice
                if (self.constraints.insert) {
                    // man is splice ever an ugly api
                    var jobVal = [ self.constraints.insert, 0 ];
                    jobVal.push.apply (jobVal, value);
                    target.splice.apply (target, jobVal);
                    if (mongoloid) {
                        if (!mongoloid.$push)
                            mongoloid.$push = {};
                        submongoloid = mongoloid.$push[path] = {
                            $each:      value,
                            $position:  self.constraints.insert
                        };
                    }
                } else if (self.constraints.append) {
                    target.push.apply (target, value);
                    if (mongoloid) {
                        if (!mongoloid.$push)
                            mongoloid.$push = {};
                        submongoloid = mongoloid.$push[path] = { $each:value };
                    }
                } else { // prepend
                    target.unshift.apply (target, value);
                    if (mongoloid) {
                        if (!mongoloid.$push)
                            mongoloid.$push = {};
                        submongoloid = mongoloid.$push[path] = {
                            $each:      value,
                            $position:  0
                        };
                    }
                }

                if (self.constraints.clip) {
                    if (self.constraints.clip >= 0)
                        target.splice (self.constraints.clip, target.length);
                    else
                        target.splice (0, Math.max (0, target.length + self.constraints.clip));
                    if (submongoloid)
                        submongoloid.$slice = self.constraints.clip;
                }
                callback (undefined, target);
            });
        }

        // sync
        // .all
        if (this.constraints.all || this.constraints.sequence) {
            for (var i=0,j=value.length; i<j; i++) {
                var childValue = value[i];

                // .all
                if (this.constraints.all)
                    try {
                        target[i] = this.constraints.all.transform (
                            childValue,
                            target[i],
                            undefined,
                            path
                        );
                    } catch (err) {
                        throw new TransformError (
                            'INVALID',
                            value,
                            path,
                            'result value failed .all validation',
                            err
                        );
                    }

                // .sequence
                if (this.constraints.sequence)
                    if (this.constraints.sequence[i]) {
                        target[i] = this.constraints.sequence[i].transform (
                            childValue,
                            target[i],
                            undefined,
                            path
                        );
                    } else if (this.constraints.extras)
                        target[i] = this.constraints.extras.transform (
                            childValue,
                            target[i],
                            undefined,
                            path
                        );
                    else
                        throw new TransformError (
                            'ILLEGAL',
                            undefined,
                            childValue,
                            this.path,
                            'found unexpected array item'
                        );
                if (exists)
                    // .exists
                    for (var k=0,l=exists.length; k<l; k++)
                        try {
                            exists[k].validate (target[i]);
                            if (!--existsLives[k]) {
                                exists.splice (k, 1);
                                existsLives.splice (k, 1);
                                k--; l--;
                            }
                        } catch (err) { /* nobody cares */ }
            }
        }

        var submongoloid; // if we write anything to the mongoloid, this passes it to .clip
        if (this.constraints.insert) {
            // man is splice ever an ugly api
            var jobVal = [ this.constraints.insert, 0 ];
            jobVal.push.apply (jobVal, value);
            target.splice.apply (target, jobVal);
            if (mongoloid) {
                if (!mongoloid.$push)
                    mongoloid.$push = {};
                submongoloid = mongoloid.$push[path] = {
                    $each:      value,
                    $position:  this.constraints.insert
                };
            }
        } else if (this.constraints.append) {
            target.push.apply (target, value);
            if (mongoloid) {
                if (!mongoloid.$push)
                    mongoloid.$push = {};
                submongoloid = mongoloid.$push[path] = { $each:value };
            }
        } else if (this.constraints.prepend) { // prepend
            target.unshift.apply (target, value);
            if (mongoloid) {
                if (!mongoloid.$push)
                    mongoloid.$push = {};
                submongoloid = mongoloid.$push[path] = {
                    $each:      value,
                    $position:  0
                };
            }
        } else {
            // overwrite target Array
            if (!this.constraints.all && !this.constraints.sequence) {
                target.splice (0, target.length); // drops all elements from target
                target.push.apply (target, value);
                if (this.constraints.clip)
                    if (this.constraints.clip >= 0)
                        target.splice (this.constraints.clip, target.length);
                    else
                        target.splice (0, Math.max (0, target.length + this.constraints.clip));
            }

            if (mongoloid) {
                if (!mongoloid.$set)
                    mongoloid.$set = {};
                mongoloid.$set[path] = target;
            }
        }

        // .exists
        if (exists) {
            for (var i=0,j=exists.length; i<j; i++)
                for (var k=0,l=target.length; k<l; k++)
                    try {
                        exists[i].validate (target[k]);
                        if (!--existsLives[i]) {
                            exists.splice (i, 1);
                            existsLives.splice (i, 1);
                            i--; j--;
                            break;
                        }
                    } catch (err) { /* nobody cares */ }
            if (exists.length) {
                throw new TransformError (
                    'MISSING',
                    undefined,
                    target,
                    this.path,
                    'result document does not pass all .exists constraints'
                );
            }
        }

        if (this.constraints.clip) {
            if (this.constraints.clip >= 0)
                target.splice (this.constraints.clip, target.length);
            else
                target.splice (0, Math.max (0, target.length + this.constraints.clip));
            if (submongoloid)
                submongoloid.$slice = this.constraints.clip;
        }

        // min
        if (this.constraints.min !== undefined && value.length < this.constraints.min)
            throw new TransformError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too few keys on Object'
            );

        // max
        if (this.constraints.max !== undefined && value.length > this.constraints.max)
            throw new TransformError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too many keys on Object'
            );

        // length
        if (this.constraints.length !== undefined && value.length != this.constraints.length)
            throw new TransformError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too many keys on Object'
            );

        if (callback) return process.nextTick (function(){ callback (undefined, target); });
        return target;
    },
    string:     function (value, target, mongoloid, callback, path) {
        path = path || this.path;
        if (typeof value != 'string')
            value = JSON.stringify (value);

        if (this.constraints.case) {
            var setCase = this.constraints.case;
            if (setCase == 'upper')
                value = value.toUpperCase();
            else if (setCase == 'lower')
                value = value.toLowerCase();
        }

        if (this.constraints.inject) {
            for (var i in this.constraints.inject) {
                var injection = this.constraints.inject[i];
                if (injection.length == 1)
                    value += injection[0];
                else if (typeof injection[0] != 'number' || isNaN (injection[0]))
                    value += injection[1];
                else
                    // value.splice (injection[0], 0, injection[1]);
                    value =
                        value.slice (0, injection[0])
                      + injection[1]
                      + value.slice (injection[0])
                      ;
            }
        }

        if (this.constraints.partial)
            value = value.slice (this.constraints.partial[0], this.constraints.partial[1]);

        var resultStr;
        if (!target) resultStr = value;
        else if (this.constraints.insert) {
            resultStr =
                target.slice (0, this.constraints.insert)
              + value
              + target.slice (this.constraints.insert)
              ;
        } else if (this.constraints.append) {
            if (!target) return value;
            resultStr = target + value;
        } else if (this.constraints.prepend) {
            if (!target) return value;
            resultStr = value + target;
        } else resultStr = value;

        if (this.constraints.clip)
            resultStr = resultStr.slice (0, this.constraints.clip);

        try {
            this.validate (resultStr);
        } catch (err) {
            throw new TransformError (
                'INVALID',
                resultStr,
                path,
                'source value failed validation',
                err
            );
        }

        if (mongoloid) {
            if (!mongoloid.$set)
                mongoloid.$set = {};
            mongoloid.$set[path] = resultStr;
        }

        if (callback) return process.nextTick (function(){ callback (undefined, resultStr); });
        return resultStr;
    },
    number:     function (value, target, mongoloid, callback, path) {
        path = path || this.path;
        if (typeof value == 'string') {
            // cast
            if (!value.match (RE_VALID_NUMBER))
                throw new TransformError (
                    'FORMAT',
                    value,
                    path,
                    'could not convert String to Number'
                );
            value = parseFloat (value);
        }

        if (this.constraints.normal)
            value = value / this.constraints.normal;
        else if (this.constraints.modFilter)
            value = value % this.constraints.modFilter;

        if (this.constraints.inverse)
            value = -1 * value;
        if (this.constraints.reciprocal)
            value = 1 / value;

        target = target || 0;
        if (this.constraints.multiply) {
            if (mongoloid) {
                if (!mongoloid.$mul)
                    mongoloid.$mul = {};
                mongoloid.$mul[path] = value;
            }
            value = target * value;
        } else if (this.constraints.divide) {
            if (mongoloid) {
                if (!mongoloid.$mul)
                    mongoloid.$mul = {};
                mongoloid.$mul[path] = 1 / value;
            }
            value = target / value;
        } else if (this.constraints.add) {
            if (mongoloid) {
                if (!mongoloid.$inc)
                    mongoloid.$inc = {};
                mongoloid.$inc[path] = value;
            }
            value = target + value;
        } else if (this.constraints.subtract) {
            if (mongoloid) {
                if (!mongoloid.$inc)
                    mongoloid.$inc = {};
                mongoloid.$inc[path] = -1 * value;
            }
            value = target - value;
        } else if (mongoloid) {
            if (!mongoloid.$set)
                mongoloid.$set = {};
            mongoloid.$set[path] = value;
        }

        try {
            this.validate (value);
        } catch (err) {
            throw new TransformError (
                'INVALID',
                value,
                path,
                'result value failed validation',
                err
            );
        }

        if (callback) return process.nextTick (function(){ callback (undefined, value); });
        return value;
    },
    boolean:    function (value, target, mongoloid, callback, path) {
        path = path || this.path;
        if (typeof value == 'string') {
            // cast
            var canonical = value.toLowerCase();
            if (canonical == 'true')
                value = true;
            else if (canonical == 'false')
                value = false;
            else throw new TransformError (
                'FORMAT',
                value,
                path,
                'could not convert String to Boolean'
            );
        }

        if (this.constraints.inverse)
            value = !value;

        if (mongoloid) {
            if (!mongoloid.$set)
                mongoloid.$set = {};
            mongoloid.$set[path] = value;
        }

        if (callback) return process.nextTick (function(){ callback (undefined, value); });
        return value;
    }
};

module.exports = TYPE_TRANSFORMERS;
