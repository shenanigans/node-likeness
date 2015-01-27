
var async = require ('async');
var getTypeStr = require ('./GetTypeStr');
var TransformError = require ('./errors').TransformError;

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

    for (var key in source) {
        var val = source[key];
        var subpath = path ? path+'.'+key : undefined;

        if (!Object.hasOwnProperty.call (target, key)) {
            if (mongoloid) {
                if (!mongoloid.$set)
                    mongoloid.$set = {};
                mongoloid.$set[subpath] = val;
            }
            if (getTypeStr (val) == 'object') {
                output[key] = simpleMerge (val, {}, mongoloid, subpath);
                continue;
            }
            if (getTypeStr (val) == 'array') {
                output[key] = simpleArrayMerge (val, [], mongoloid, subpath);
                continue;
            }
            output[key] = val;
            continue;
        }

        var childType = getTypeStr (val);
        if (childType == 'object')
            output[key] = simpleMerge (val, target[key] || {}, mongoloid, subpath);
        else if (childType == 'array')
            output[key] = simpleArrayMerge (val, target[key] || [], mongoloid, subpath);
        else
            output[key] = val;
    }

    return output;
}

function simpleArrayMerge (source, target, mongoloid, path) {
    var output = [];
    output.push (output, target);

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

        // children - async
        // ====================================================================
        if (callback) {
            var self = this;

            // .insert
            if (this.constraints.insert) {
                // step into the new child key
                var newValue;
                // does the insertion key have a schema?
                if (Object.hasOwnProperty.call (this.children, this.constraints.insert)) {
                    var childSchema = this.children[this.constraints.insert];
                    // insertion key exists on target?
                    if (Object.hasOwnProperty.call (target, this.constraints.insert))
                        return childSchema.transform (
                            value,
                            target[this.constraints.insert],
                            mongoloid,
                            function (err, newValue) {
                                if (err) return callback (err);

                                // .clip
                                if (self.constraints.clip) {
                                    var clip = self.constraints.clip;
                                    var keys = Object.keys (newValue);
                                    var dropKeys;
                                    if (clip >= 0)
                                        dropKeys = keys.slice (0, Math.max (0, keys.length - clip))
                                    else
                                        dropKeys = keys.slice (clip * -1);
                                    for (var i in dropKeys)
                                        delete newValue[dropKeys[i]];
                                }

                                callback (undefined, newValue);
                            },
                            subpath
                        );
                    else
                        return childSchema.transform (
                            value,
                            target[this.constraints.insert] = {},
                            mongoloid,
                            function (err, newValue) {
                                if (err) return callback (err);
                                target[self.constraints.insert] = newValue;

                                // .clip
                                if (self.constraints.clip) {
                                    var clip = self.constraints.clip;
                                    var keys = Object.keys (newValue);
                                    var dropKeys;
                                    if (clip >= 0)
                                        dropKeys = keys.slice (0, Math.max (0, keys.length - clip))
                                    else
                                        dropKeys = keys.slice (clip * -1);
                                    for (var i in dropKeys)
                                        delete newValue[dropKeys[i]];
                                }

                                if (mongoloid) {
                                    if (!mongoloid.$set)
                                        mongoloid.$set = {};
                                    mongoloid.$set[subpath] = newValue;
                                }
                                callback (undefined, target);
                            },
                            subpath
                        );
                } else {
                    // inserting into a key without its own schema

                    // .clip
                    if (self.constraints.clip) {
                        var clip = self.constraints.clip;
                        var keys = Object.keys (newValue);
                        var dropKeys;
                        if (clip >= 0)
                            dropKeys = keys.slice (0, Math.max (0, keys.length - clip))
                        else
                            dropKeys = keys.slice (clip * -1);
                        for (var i in dropKeys)
                            delete newValue[dropKeys[i]];
                    }

                    if (
                        !Object.hasOwnProperty.call (target, this.constraints.insert)
                     || getTypeStr (target[this.constraints.insert]) != 'object'
                    )
                        newValue = value;
                    else
                        newValue = merge (
                            value,
                            target[this.constraints.insert],
                            mongoloid,
                            path + this.constraints.insert
                        );

                    if (mongoloid) {
                        if (!mongoloid.$set)
                            mongoloid.$set = {};
                        mongoloid.$set[subpath] = newValue;
                    }
                    target[this.constraints.insert] = newValue;
                    return callback (undefined, target);
                }
            }

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
                if (Object.hasOwnProperty.call (self.children, name)) {
                    // known key
                    var childSchema = self.children[name];
                    return childSchema.transform (
                        newValue,
                        target[name],
                        mongoloid,
                        function (err, newValue) {
                            if (err) return callback (err);

                            // .all
                            if (self.constraints.all)
                                return self.constraints.all.transform (
                                    newValue,
                                    target[name],
                                    mongoloid,
                                    function (err, newValue) {
                                        if (err)
                                            return callback (new TransformError (
                                                'INVALID',
                                                value,
                                                path,
                                                'source value failed .all validation',
                                                err
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
                                    },
                                    subpath
                                );

                            // no .all
                            // .filter
                            if (self.constraints.filter)
                                return self.constraints.filter.validate (newValue, function (err) {
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
                                });

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
                        },
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

                        // KEYWORD passed keytest, proceed with everything else

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
                        function (err, newValue) {
                            if (err)
                                return callback (new TransformError (
                                    'INVALID',
                                    value,
                                    subpath,
                                    'source value failed .all validation',
                                    err
                                ));

                            // .filter
                            if (self.constraints.filter)
                                return self.constraints.filter.validate (
                                    newValue,
                                    function (err, newValue) {
                                        if (err) return callback (err);

                                        if (!Object.hasOwnProperty.call (target, name)) {
                                            if (targetLen) targetLen++;
                                            if (mongoloid) {
                                                if (!mongoloid.$set)
                                                    mongoloid.$set = {};
                                                mongoloid.$set[subpath] = newValue;
                                            }
                                        }

                                        if (Object.hasOwnProperty.call (target, name)) {
                                            target[name] = merge (
                                                newValue,
                                                target[name],
                                                mongoloid,
                                                path + name
                                            );
                                            return callback();
                                        }

                                        targetLen++;
                                        target[name] = newValue;
                                        callback();
                                    }
                                );

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
                            if (mongoloid) {
                                if (!mongoloid.$set)
                                    mongoloid.$set = {};
                                mongoloid.$set[subpath] = newValue;
                            }
                            callback();
                        },
                        subpath
                    );


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
                    target[name] = merge (newValue, newDoc, mongoloid, path ? path + '.' + name : name);
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
        if (this.constraints.insert) {
            // step into the new child key
            var newValue;
            var fullpath = path ?
                path + '.' + this.constraints
              : this.constraints
              ;

            // does the insertion key have a schema?
            if (Object.hasOwnProperty.call (this.children, this.constraints.insert)) {
                var childSchema = this.children[this.constraints.insert];
                // insertion key exists on target?
                if (Object.hasOwnProperty.call (target, this.constraints.insert))
                    newValue = childSchema.transform (
                        value,
                        target[this.constraints.insert],
                        mongoloid,
                        undefined,
                        fullpath
                    );
                else {
                    newValue = childSchema.transform (
                        value,
                        target[this.constraints.insert] = {},
                        mongoloid,
                        undefined,
                        fullpath
                    );
                    target[this.constraints.insert] = newValue;
                    if (mongoloid) {
                        if (!mongoloid.$set)
                            mongoloid.$set = {};
                        mongoloid.$set[fullpath] = newValue;
                    }
                }
            } else {
                if (
                    !Object.hasOwnProperty.call (target, this.constraints.insert)
                 || getTypeStr (target[this.constraints.insert]) != 'object'
                )
                    newValue = value;
                else
                    newValue = merge (value, target[this.constraints.insert], mongoloid, fullpath);
                target[this.constraints.insert] = newValue;
                if (mongoloid) {
                    if (!mongoloid.$set)
                        mongoloid.$set = {};
                    mongoloid.$set[fullpath] = newValue;
                }
            }
            return target;
        }

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
            if (Object.hasOwnProperty.call (this.children, name)) {
                // known key
                var childSchema = this.children[name];
                if (!Object.hasOwnProperty.call (target, name)) {
                    // key not found on target
                    // key count issues?
                    if (targetLen && this.constraints.max == targetLen && !this.constraints.clip)
                        throw new TransformError (
                            'LIMIT',
                            newValue,
                            childSchema.path,
                            'new source key exceeds maximum key limit'
                        );
                }

                // .all
                if (!this.constraints.all)
                    newValue = childSchema.transform (newValue, target[name], mongoloid);
                else
                    try {
                        newValue = childSchema.transform (newValue, target[name]);
                        newValue = this.constraints.all.transform (
                            newValue,
                            target[name],
                            mongoloid,
                            undefined,
                            subpath
                        );
                    } catch (err) {
                        throw new TransformError (
                            'INVALID',
                            value,
                            path,
                            'source value failed .all validation',
                            err
                        );
                    }

                // .filter
                if (this.constraints.filter)
                    try {
                        this.constraints.filter.validate (newValue);
                    } catch (err) { continue; /* it's ok, just drop it */ }

                target[name] = newValue;
                if (targetLen) targetLen++;
                continue;
            }

            // unknown key

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

            // .all
            if (this.constraints.all)
                try {
                    newValue = this.constraints.all.transform (
                        newValue,
                        target[name],
                        mongoloid,
                        undefined,
                        subpath
                    );
                } catch (err) {
                    throw new TransformError (
                        'INVALID',
                        value,
                        subpath,
                        'source value failed .all validation',
                        err
                    );
                }

            // .filter
            if (this.constraints.filter)
                try {
                    this.constraints.filter.validate (newValue);
                } catch (err) { continue; /* it's ok, just drop it */ }


            if (Object.hasOwnProperty.call (target, name)) {
                newValue = merge (
                    newValue,
                    target[name],
                    mongoloid,
                    path ? path + '.' + name : name
                );
                target[name] = newValue;
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

            if (getTypeStr (newValue) == 'object') {
                target[name] = merge (
                    newValue,
                    {},
                    mongoloid,
                    path ? path + '.' + name : name
                );
                continue;
            }

            target[name] = newValue;
            if (mongoloid) {
                if (!mongoloid.$set)
                    mongoloid.$set = {};
                mongoloid.$set[path ? path + name : name] = newValue;
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

        // .max
        if (
            this.constraints.max
         && value.length + target.length > this.constraints.max
         && ( !this.constraints.clip && !this.constraints.slice )
        )
            throw new TransformError (
                'LIMIT',
                value,
                path,
                'new Array data exceeds maximum length'
            );

        // .all
        if (this.constraints.all) {
            if (callback) {
                var self = this;
                return async.each (value, function (subvalue, callback) {
                    self.constraints.all.validate (subvalue, callback);
                }, function (err) {
                    if (err)
                        return callback (new TransformError (
                            'INVALID',
                            value,
                            self.path,
                            'source value failed .all validation',
                            err
                        ));

                    if (!self.constraints.insert && !self.constraints.append && !self.constraints.prepend) {
                        target.splice (0, target.length); // drops all elements from target
                        target.push.apply (target, value);
                        if (self.constraints.clip)
                            if (self.constraints.clip >= 0)
                                target.splice (self.constraints.clip, target.length);
                            else
                                target.splice (0, Math.max (0, target.length + self.constraints.clip));
                        else if (self.constraints.slice) {
                            target.splice (self.constraints.slice[1], target.length);
                            target.splice (0, self.constraints.slice[0]);
                        }

                        if (mongoloid) {
                            if (!mongoloid.$set)
                                mongoloid.$set = {};
                            mongoloid.$set[path] = target;
                        }

                        if (callback) return process.nextTick (function(){ callback (undefined, target); });
                        return target;
                    }

                    var submongoloid; // if we write anything to the mongoloid, self passes it to .clip/.slice
                    if (self.constraints.insert) {
                        // man is splice ever an ugly api
                        var jobVal = [ self.constraints.insert, 0 ];
                        jobVal.push.apply (jobVal, value);
                        target.splice.apply (target, jobVal);
                        if (mongoloid && !self.constraints.slice) {
                            if (!mongoloid.$push)
                                mongoloid.$push = {};
                            submongoloid = mongoloid.$push[path] = {
                                $each:      value,
                                $position:  self.constraints.insert
                            };
                        }
                    } else if (self.constraints.append) {
                        target.push.apply (target, value);
                        if (mongoloid && !self.constraints.slice) {
                            if (!mongoloid.$push)
                                mongoloid.$push = {};
                            submongoloid = mongoloid.$push[path] = { $each:value };
                        }
                    } else { // prepend
                        target.unshift.apply (target, value);
                        if (mongoloid && !self.constraints.slice) {
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
                    } else if (self.constraints.slice) {
                        target.splice (self.constraints.slice[1], target.length);
                        target.splice (0, self.constraints.slice[0]);
                        if (mongoloid) {
                            if (!mongoloid.$set)
                                mongoloid.$set = {};
                            if (mongoloid.$push)
                                delete mongoloid.$push[path];
                            mongoloid.$set[path] = target;
                        }
                    }
                    callback (undefined, target);
                });
            }

            // sync .all
            for (var i in value)
                try {
                    this.constraints.all.validate (value[i]);
                } catch (err) {
                    throw new TransformError (
                        'INVALID',
                        value,
                        path,
                        'source value failed .all validation',
                        err
                    );
                }
        }

        if (!this.constraints.insert && !this.constraints.append && !this.constraints.prepend) {
            target.splice (0, target.length); // drops all elements from target
            target.push.apply (target, value);
            if (this.constraints.clip)
                if (this.constraints.clip >= 0)
                    target.splice (this.constraints.clip, target.length);
                else
                    target.splice (0, Math.max (0, target.length + this.constraints.clip));
            else if (this.constraints.slice) {
                target.splice (this.constraints.slice[1], target.length);
                target.splice (0, this.constraints.slice[0]);
            }

            // min
            if (this.constraints.min !== undefined && value.length < this.constraints.min)
                throw new TransformError (
                    'LIMIT',
                    this.constraints.min,
                    value,
                    this.path,
                    'Array length below minimum'
                );

            // max
            if (this.constraints.max !== undefined && value.length > this.constraints.max)
                throw new TransformError (
                    'LIMIT',
                    this.constraints.min,
                    value,
                    this.path,
                    'Array length above maximum'
                );

            // length
            if (this.constraints.length !== undefined && value.length != this.constraints.length)
                throw new TransformError (
                    'LIMIT',
                    this.constraints.length,
                    value,
                    this.path,
                    'invalid Array length'
                );

            if (mongoloid) {
                if (!mongoloid.$set)
                    mongoloid.$set = {};
                mongoloid.$set[path] = target;
            }

            if (callback) return process.nextTick (function(){ callback (undefined, target); });
            return target;
        }

        var submongoloid; // if we write anything to the mongoloid, this passes it to .clip/.slice
        if (this.constraints.insert) {
            // man is splice ever an ugly api
            var jobVal = [ this.constraints.insert, 0 ];
            jobVal.push.apply (jobVal, value);
            target.splice.apply (target, jobVal);
            if (mongoloid && !this.constraints.slice) {
                if (!mongoloid.$push)
                    mongoloid.$push = {};
                submongoloid = mongoloid.$push[path] = {
                    $each:      value,
                    $position:  this.constraints.insert
                };
            }
        } else if (this.constraints.append) {
            target.push.apply (target, value);
            if (mongoloid && !this.constraints.slice) {
                if (!mongoloid.$push)
                    mongoloid.$push = {};
                submongoloid = mongoloid.$push[path] = { $each:value };
            }
        } else { // prepend
            target.unshift.apply (target, value);
            if (mongoloid && !this.constraints.slice) {
                if (!mongoloid.$push)
                    mongoloid.$push = {};
                submongoloid = mongoloid.$push[path] = {
                    $each:      value,
                    $position:  0
                };
            }
        }

        if (this.constraints.clip) {
            if (this.constraints.clip >= 0)
                target.splice (this.constraints.clip, target.length);
            else
                target.splice (0, Math.max (0, target.length + this.constraints.clip));
            if (submongoloid)
                submongoloid.$slice = this.constraints.clip;
        } else if (this.constraints.slice) {
            target.splice (this.constraints.slice[1], target.length);
            target.splice (0, this.constraints.slice[0]);
            if (mongoloid) {
                if (!mongoloid.$set)
                    mongoloid.$set = {};
                if (mongoloid.$push)
                    delete mongoloid.$push[path];
                mongoloid.$set[path] = target;
            }
        }

        // minKeys
        if (this.constraints.min !== undefined && value.length < this.constraints.min)
            throw new TransformError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too few keys on Object'
            );

        // maxKeys
        if (this.constraints.max !== undefined && value.length > this.constraints.max)
            throw new TransformError (
                'LIMIT',
                this.constraints.min,
                value,
                this.path,
                'too many keys on Object'
            );

        // keys
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
        else if (this.constraints.slice)
            resultStr = resultStr.slice (this.constraints.slice[0], this.constraints.slice[1]);

        try {
            this.validate (resultStr);
        } catch (err) {
            throw new TransformError (
                'INVALID',
                value,
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
        } else if (this.constraints.total) {
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
                'source value failed validation',
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
