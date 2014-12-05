
var async = require ('async');
var getTypeStr = require ('./GetTypeStr');
var TransformError = require ('./errors').TransformError;

var RE_VALID_NUMBER = /^\s*\d+(?:\.\d+)?\s*$/;

function simpleMerge (source, target) {
    for (var key in source) {
        var val = source[key];
        if (!Object.hasOwnProperty.call (target, key)) {
            target[key] = val;
            continue;
        }

        var childType = getTypeStr (val);
        var tval = target[key];
        var tvalType = getTypeStr (tval);
        if (childType != tvalType) {
            target[key] = val;
            continue;
        }
        if (childType == 'object')
            simpleMerge (val, tval);
        else if (childType == 'array')
            simpleArrayMerge (val, tval);
        else
            target[key] = val;
    }
}

function simpleArrayMerge (source, target) {
    for (var i in source) {
        var val = source[i];
        if (i >= target.length) {
            target.push (val);
            continue;
        }

        var childType = getTypeStr (val);
        var tval = target[i];
        var tvalType = getTypeStr (tval);
        if (childType != tvalType) {
            target[i] = val;
            continue;
        }
        if (childType == 'object')
            simpleMerge (val, tval);
        else if (childType == 'array')
            simpleArrayMerge (val, tval);
        else
            target[i] = val;
    }
}

var TYPE_TRANSFORMERS = {
    object:     function (value, target, mongoloid, callback) {
        if (typeof value == 'string') {
            try {
                value = JSON.parse (value);
            } catch (err) {
                throw new TransformError (
                    'FORMAT',
                    value,
                    this.path,
                    'failed to cast String to Object'
                );
            }
            if (getTypeStr (value) != 'object')
                throw new TransformError (
                    'FORMAT',
                    value,
                    this.path,
                    'failed to cast String to Object'
                );
        }

        if (this.constraints.inject)
            for (var i in this.constraints.inject) {
                var injection = this.constraints.inject[i];
                value[injection[0]] = injection[1];
            }

        var targetLen;
        if (this.constraints.max)
            targetLen = Object.keys (target).length;

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
                            callback
                        );
                    else
                        return childSchema.transform (
                            value,
                            target[this.constraints.insert] = {},
                            mongoloid,
                            function (err, newValue) {
                                if (err) return callback (err);
                                target[self.constraints.insert] = newValue;
                                callback (undefined, newValue);
                            }
                        );
                } else {
                    if (
                        !Object.hasOwnProperty.call (target, this.constraints.insert)
                     || getTypeStr (target[this.constraints.insert]) != 'object'
                    )
                        newValue = value;
                    else {
                        newValue = {};
                        simpleMerge (value, newValue);
                    }
                    target[this.constraints.insert] = newValue;
                    return process.nextTick (function(){ callback (undefined, newValue); });
                }
            }

            var keys = Object.keys (value);
            var rename = this.constraints.rename;
            var drop = this.constraints.drop;
            return async.each (keys, function (name, callback) {
                // .rename
                var newValue = value[name];
                if (rename && Object.hasOwnProperty.call (rename, name))
                    name = rename[name];
                // .drop
                if (drop && Object.hasOwnProperty.call (drop, name))
                    return callback();

                // child processing
                if (Object.hasOwnProperty.call (self.children, name)) {
                    // known key
                    var childSchema = self.children[name];
                    if (!Object.hasOwnProperty.call (target, name)) {
                        // key not found on target
                        // key count issues?
                        if (targetLen && self.constraints.max == targetLen && !self.constraints.clip)
                            return callback (new TransformError (
                                'LIMIT',
                                newValue,
                                childSchema.path,
                                'new source key exceeds maximum key limit'
                            ));
                    }

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
                                                self.path,
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
                                                    if (targetLen) targetLen++;
                                                    callback();
                                                }
                                            );

                                        target[name] = newValue;
                                        if (targetLen) targetLen++;
                                        callback();
                                    }
                                );

                            // .filter
                            if (self.constraints.filter)
                                return self.constraints.filter.validate (newValue, function (err) {
                                    if (err)
                                        return callback(); // .filter drops quietly
                                    target[name] = newValue;
                                    if (targetLen) targetLen++;
                                    callback();
                                });

                            target[name] = newValue;
                            if (targetLen) targetLen++;
                            callback();
                        }
                    );
                }

                // unknown key
                if (self.constraints.keyTest)
                    try {
                        self.constraints.keyTest.validate (name)
                    } catch (err) {
                        throw new TransformError (
                            'ILLEGAL',
                            value,
                            self.path ? self.path + '.' + name : name,
                            'source key rejected by .keyTest',
                            err
                        );
                    }
                else if (!self.constraints.adHoc)
                    throw new TransformError (
                        'ILLEGAL',
                        value,
                        self.path ? self.path + '.' + name : name,
                        'found unknown key'
                    );

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
                                    self.path,
                                    'source value failed .all validation',
                                    err
                                ));

                            // .filter
                            if (self.constraints.filter)
                                return self.constraints.filter.validate (
                                    newValue,
                                    function (err, newValue) {
                                        if (err) return callback (err);

                                        if (Object.hasOwnProperty.call (target, name)) {
                                            simpleMerge (newValue, target[name]);
                                            return callback();
                                        }

                                        // .max
                                        if (targetLen) {
                                            if (targetLen == self.constraints.max && !self.constraints.clip)
                                                return callback (new TransformError (
                                                    'LIMIT',
                                                    value,
                                                    self.path ? self.path + '.' + name : name,
                                                    'new source key exceeds maximum key limit'
                                                ));
                                            targetLen++;
                                        }
                                        target[name] = newValue;
                                        callback();
                                    }
                                );

                            if (Object.hasOwnProperty.call (target, name)) {
                                simpleMerge (newValue, target[name]);
                                return callback();
                            }

                            // .max
                            if (targetLen) {
                                if (targetLen == self.constraints.max && !self.constraints.clip)
                                    return callback (new TransformError (
                                        'LIMIT',
                                        value,
                                        self.path ? self.path + '.' + name : name,
                                        'new source key exceeds maximum key limit'
                                    ));
                                targetLen++;
                            }
                            target[name] = newValue;
                            callback();
                        }
                    );


                // .filter
                if (self.constraints.filter)
                    return self.constraints.filter.validate (
                        newValue,
                        function (err, newValue) {
                            if (err) return callback (err);

                            if (Object.hasOwnProperty.call (target, name)) {
                                simpleMerge (newValue, target[name]);
                                return callback();
                            }

                            // .max
                            if (targetLen) {
                                if (targetLen == self.constraints.max && !self.constraints.clip)
                                    return callback (new TransformError (
                                        'LIMIT',
                                        value,
                                        self.path ? self.path + '.' + name : name,
                                        'new source key exceeds maximum key limit'
                                    ));
                                targetLen++;
                            }
                            target[name] = newValue;
                            callback();
                        }
                    );

                if (Object.hasOwnProperty.call (target, name)) {
                    simpleMerge (newValue, target[name]);
                    return callback();
                }

                // .max
                if (targetLen) {
                    if (targetLen == self.constraints.max && !self.constraints.clip)
                        return callback (new TransformError (
                            'LIMIT',
                            value,
                            self.path ? self.path + '.' + name : name,
                            'new source key exceeds maximum key limit'
                        ));
                    targetLen++;
                }
                target[name] = newValue;
                callback();
            }, function (err) {
                callback (err, target);
            });
        }


        // children - sync
        // ====================================================================
        // .insert
        if (this.constraints.insert) {
            // step into the new child key
            var newValue;
            // does the insertion key have a schema?
            if (Object.hasOwnProperty.call (this.children, this.constraints.insert)) {
                var childSchema = this.children[this.constraints.insert];
                // insertion key exists on target?
                if (Object.hasOwnProperty.call (target, this.constraints.insert))
                    newValue = childSchema.transform (
                        value,
                        target[this.constraints.insert],
                        mongoloid
                    );
                else {
                    newValue = childSchema.transform (
                        value,
                        target[this.constraints.insert] = {},
                        mongoloid
                    );
                    target[this.constraints.insert] = newValue;
                }
            } else {
                if (
                    !Object.hasOwnProperty.call (target, this.constraints.insert)
                 || getTypeStr (target[this.constraints.insert]) != 'object'
                )
                    newValue = value;
                else {
                    newValue = {};
                    simpleMerge (value, newValue);
                }
                target[this.constraints.insert] = newValue;
            }
            return newValue;
        }

        var rename = this.constraints.rename;
        var drop = this.constraints.drop;
        for (var name in value) {
            // .rename
            var newValue = value[name];
            if (rename && Object.hasOwnProperty.call (rename, name))
                name = rename[name];
            // .drop
            if (drop && Object.hasOwnProperty.call (drop, name))
                continue;

            // child processing
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

                newValue = childSchema.transform (newValue, target[name], mongoloid);

                // .all
                if (this.constraints.all)
                    try {
                        newValue = this.constraints.all.transform (newValue, target[name], mongoloid);
                    } catch (err) {
                        throw new TransformError (
                            'INVALID',
                            value,
                            this.path,
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

            // .filter
            if (this.constraints.filter)
                try {
                    this.constraints.filter.validate (newValue);
                } catch (err) { continue; /* it's ok, just drop it */ }

            // unknown key
            if (this.constraints.keyTest)
                try {
                    this.constraints.keyTest.validate (name)
                } catch (err) {
                    throw new TransformError (
                        'ILLEGAL',
                        value,
                        this.path ? this.path + '.' + name : name,
                        'source key rejected by .keyTest',
                        err
                    );
                }
            else if (!this.constraints.adHoc)
                throw new TransformError (
                    'ILLEGAL',
                    value,
                    this.path ? this.path + '.' + name : name,
                    'found unknown key'
                );

            // .all
            if (this.constraints.all)
                try {
                    newValue = this.constraints.all.transform (newValue, target[name], mongoloid);
                } catch (err) {
                    throw new TransformError (
                        'INVALID',
                        value,
                        this.path,
                        'source value failed .all validation',
                        err
                    );
                }

            if (Object.hasOwnProperty.call (target, name)) {
                simpleMerge (newValue, target[name]);
                continue;
            }

            if (targetLen) {
                if (targetLen == this.constraints.max && !this.constraints.clip)
                    throw new TransformError (
                        'LIMIT',
                        value,
                        this.path ? this.path + '.' + name : name,
                        'new source key exceeds maximum key limit'
                    );
                targetLen++;
            }
            target[name] = newValue;
        }

        if (this.constraints.clip) {
            var clip = this.constraints.clip;
            var keys = Object.keys (target);
            var dropKeys;
            if (clip >= 0)
                dropKeys = keys.slice (0, Math.max (0, keys.length - clip))
            else
                dropKeys = keys.slice (clip * -1);
            for (var i in dropKeys)
                delete target[dropKeys[i]];
        }

        return target;
    },
    array:      function (value, target, mongoloid, callback) {
        if (typeof value == 'string') {
            if (this.constraints.cast) {
                // cast
                try {
                    value = JSON.parse (value);
                } catch (err) {
                    throw new TransformError (
                        'FORMAT',
                        value,
                        this.path,
                        'failed to cast String to Array',
                        err
                    );
                }

                if (!(value instanceof Array))
                    throw new TransformError (
                        'FORMAT',
                        value,
                        this.path,
                        'failed to cast String to Array'
                    );
            } else if (this.constraints.group) {
                var output = [];
                var info;
                while (info = this.constraints.group.exec (value))
                    output.push.apply (output, info.slice (0));
                if (output.length)
                    if (callback) return process.nextTick (function(){ callback (undefined, output); });
                    else return output;
                throw new TransformError (
                    'FORMAT',
                    value,
                    this.path,
                    'failed to match input string'
                );

            } else { // split
                var result = value.split (this.constraints.split);
                if (callback) return process.nextTick (function(){ callback (undefined, result); });
                else return result;
            }
        }

        // .inject
        if (this.constraints.inject) {
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

        // .max
        if (
            this.constraints.max
         && value.length + target.length > this.constraints.max
         && ( !this.constraints.clip && !this.constraints.slice )
        )
            throw new TransformError (
                'LIMIT',
                value,
                this.path,
                'new Array data exceeds maximum length'
            );

        // .all
        if (this.constraints.all) {
            if (callback) {
                var self = this;
                return async.each (value, function (subvalue, callback) {
                    self.constraints.all.validate (subvalue, callback);
                }, function (err) {
                    if (err) return callback (err);

                    if (!this.constraints.insert && !this.constraints.append && !this.constraints.prepend) {
                        target.splice (0, target.length);
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
                        return callback (undefined, target);
                    }

                    if (this.constraints.insert) {
                        // man is splice ever an ugly api
                        value.unshift (0);
                        value.unshift (this.constraints.insert);
                        target.splice.apply (target, value);
                    } else if (this.constraints.append) {
                        target.push.apply (target, value);
                    } else if (this.constraints.prepend) {
                        target.unshift.apply (target, value);
                    } else // the default behavior is .append
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
                    callback (undefined, target);
                });
            }
            for (var i in value)
                try {
                    this.constraints.all.validate (value[i]);
                } catch (err) {
                    throw new TransformError (
                        'INVALID',
                        value,
                        this.path,
                        'source value failed .all validation',
                        err
                    );
                }
        }

        if (!this.constraints.insert && !this.constraints.append && !this.constraints.prepend) {
            target.splice (0, target.length);
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
            if (callback) return process.nextTick (function(){ callback (undefined, target); });
            return target;
        }

        if (this.constraints.insert) {
            // man is splice ever an ugly api
            value.unshift (0);
            value.unshift (this.constraints.insert);
            target.splice.apply (target, value);
        } else if (this.constraints.append) {
            target.push.apply (target, value);
        } else if (this.constraints.prepend) {
            target.unshift.apply (target, value);
        } else // the default behavior is .append
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
        if (callback) return process.nextTick (function(){ callback (undefined, target); });
        return target;
    },
    string:     function (value, target, mongoloid, callback) {
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
                this.path,
                'source value failed validation',
                err
            );
        }

        if (callback) return process.nextTick (function(){ callback (undefined, resultStr); });
        return resultStr;
    },
    number:     function (value, target, mongoloid, callback) {
        if (typeof value == 'string') {
            // cast
            if (!value.match (RE_VALID_NUMBER))
                throw new TransformError (
                    'FORMAT',
                    value,
                    this.path,
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
        if (this.constraints.multiply)
            value = target * value;
        if (this.constraints.divide)
            value = target / value;
        if (this.constraints.total)
            value = target + value;
        if (this.constraints.subtract)
            value = target - value;

        try {
            this.validate (value);
        } catch (err) {
            throw new TransformError (
                'INVALID',
                value,
                this.path,
                'source value failed validation',
                err
            );
        }

        if (callback) return process.nextTick (function(){ callback (undefined, value); });
        return value;
    },
    boolean:    function (value, target, mongoloid, callback) {
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
                this.path,
                'could not convert String to Boolean'
            );
        }

        if (this.constraints.inverse)
            value = !value;

        if (callback) return process.nextTick (function(){ callback (undefined, value); });
        return value;
    }
};

module.exports = TYPE_TRANSFORMERS;
