
var getTypeStr = require ('./GetTypeStr');
var validateFormat = require ('./Format').validate;
var Set = require ('./Set');

var RE_VALID_NUMBER = /^\s*\d+(?:\.\d+)?\s*$/;

function merge (source, target) {
    var valtype = getTypeStr (source);
    if (valtype == 'object')
        return simpleMerge (source, target || {});
    if (valtype == 'array')
        return simpleArrayMerge (source, target || []);
    return source;
}

function simpleMerge (source, target) {
    var output = {};
    for (var key in target)
        output[key] = target[key];

    var didSomething = false;
    for (var key in source) {
        var val = source[key];

        if (!Object.hasOwnProperty.call (target, key)) {
            if (getTypeStr (val) == 'object') {
                var newChild = simpleMerge (val, {});
                if (newChild !== undefined) {
                    output[key] = newChild;
                    didSomething = true;
                }
                continue;
            }
            if (getTypeStr (val) == 'array') {
                var newChild = simpleArrayMerge (val, []);
                if (newChild !== undefined) {
                    output[key] = newChild;
                    didSomething = true;
                }
                continue;
            }

            didSomething = true;
            output[key] = val;
            continue;
        }

        var childType = getTypeStr (val);
        if (childType == 'object') {
            var newChild = simpleMerge (val, target[key] || {});
            if (newChild !== undefined) {
                didSomething = true;
                output[key] = newChild;
            }
            continue;
        }
        if (childType == 'array') {
            var newChild = simpleArrayMerge (val, target[key] || []);
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

function simpleArrayMerge (source, target) {
    if (!source.length)
        return;

    var output = [];
    output.push.apply (output, target);

    for (var i=0,j=source.length; i<j; i++) {
        var val = source[i];

        if (i >= target.length) {
            output.push (val);
            continue;
        }

        var childType = getTypeStr (val);
        var tval = target[i];
        var tvalType = getTypeStr (tval);
        var nextVal;

        if (childType == 'object')
            nextVal = simpleMerge (val, tval || {});
        else if (childType == 'array')
            nextVal = simpleArrayMerge (val, tval || []);
        else
            nextVal = val;

        if (i < target.length) {
            output[i] = nextVal;
            continue;
        }

        output.push (val);
    }

    return output;
}

function clone (target) {
    var objType = getTypeStr (target);
    if (objType == 'number')
        return Number (target); // otherwise you get heap Numbers instead of natives... it's weird.
    if (objType == 'string')
        return String (target); // otherwise you get heap Strings instead of natives... it's weird.

    var newObj = objType == 'array' ? [] : {};
    for (var key in target)
        newObj[key] = target[key] ? Object.clone (target[key]) : target[key];
    return newObj;
}

var TYPE_TRANSFORMERS = {
    object:     function (target, value, root, errMessage) {
        if (this.constraints.inject) {
            // shallow copy value
            var newValue = {};
            var valueKeys = Object.keys (value);
            for (var i=0,j=valueKeys.length; i<j; i++) {
                var subkey = valueKeys[i];
                newValue[subkey] = value[subkey];
            }
            value = newValue;

            for (var i=0, j=this.constraints.inject.length; i<j; i++) {
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

        // children
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
                if (this.constraints.all)
                    nextValue = this.constraints.all.transform (
                        nextValue,
                        newValue,
                        undefined,
                        errMessage
                    );
                // known key
                if (!Object.hasOwnProperty.call (target, name)) {
                    // key not found on target
                    // key count issues?
                    if (targetLen && this.constraints.maxKeys == targetLen && !this.constraints.clip)
                        throw errMessage || 'new source key exceeds maximum key limit';
                }

                // .fill?
                if (childSchema.constraints.fill || childSchema.constraints.list)
                    nextValue = childSchema.accumulate (nextValue, newValue, root);
                else
                    nextValue = childSchema.transform (nextValue, newValue, root, errMessage);

                if (uniqueSet && !uniqueSet.add (nextValue))
                    throw errMessage || 'duplicate property';

                // .filter
                if (this.constraints.filter) {
                    var filter = this.constraints.filter;
                    if ( (function(){
                        try {
                            filter.validate (newValue, errMessage);
                            return false;
                        } catch (err) { return true; /* it's ok, just drop it */ }
                    })() )
                        continue;
                }

                if (exists && exists.length)
                    // .exists
                    for (var k=0,l=exists.length; k<l; k++)
                        (function(){
                            try {
                                exists[k].validate (nextValue, errMessage);
                                if (!--existsLives[k]) {
                                    exists.splice (k, 1);
                                    existsLives.splice (k, 1);
                                    k--; l--;
                                }
                            } catch (err) { /* nobody cares */ }
                        })();

                if (uniqueSet && !uniqueSet.add (nextValue))
                    throw errMessage || 'duplicate property';

                target[name] = nextValue;
                if (targetLen) targetLen++;
                continue;
            }

            // unknown key
            if (!this.constraints.all)
                nextValue = newValue;
            else
                nextValue = this.constraints.all.transform (
                    nextValue,
                    newValue,
                    undefined,
                    errMessage
                );

            // .keyTest
            if (this.constraints.keyTest)
                this.constraints.keyTest.validate (name, errMessage);
            else if (this.constraints.tolerant)
                continue
            else if (!this.constraints.adHoc)
                throw errMessage || 'found unknown key';

            if (uniqueSet && !uniqueSet.add (nextValue))
                throw errMessage || 'duplicate property';

            // .filter
            if (this.constraints.filter) {
                var filter = this.constraints.filter;
                if ( (function(){
                    try {
                        filter.validate (newValue, errMessage);
                        return false;
                    } catch (err) { return true;; /* it's ok, just drop it */ }
                })() )
                    continue;
            }

            // .exists
            if (exists && exists.length)
                // .exists
                for (var k=0,l=exists.length; k<l; k++)
                    (function(){
                        try {
                            exists[k].validate (nextValue, errMessage);
                            if (!--existsLives[k]) {
                                exists.splice (k, 1);
                                existsLives.splice (k, 1);
                                k--; l--;
                            }
                        } catch (err) { /* nobody cares */ }
                    })();

            if (Object.hasOwnProperty.call (target, name)) {
                nextValue = merge (
                    nextValue,
                    target[name]
                );
                target[name] = nextValue;
                continue;
            }

            if (targetLen) {
                if (targetLen == this.constraints.maxKeys && !this.constraints.clip)
                    throw errMessage || 'new source key exceeds maximum key limit';
                targetLen++;
            }

            if (getTypeStr (nextValue) == 'object') {
                target[name] = merge (
                    nextValue,
                    {}
                );
                continue;
            }

            target[name] = nextValue;
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
            for (var i=0, j=dropKeys.length; i<j; i++)
                delete target[dropKeys[i]];
        }

        // minKeys
        if (this.constraints.minKeys !== undefined && names.length < this.constraints.minKeys)
            throw errMessage || 'too few keys on Object';

        // maxKeys
        if (this.constraints.maxKeys !== undefined && names.length > this.constraints.maxKeys)
            throw errMessage || 'too many keys on Object';

        // keyCount
        if (this.constraints.keyCount !== undefined && names.length != this.constraints.keyCount)
            throw errMessage || 'too many keys on Object';

        // mandatory keys
        var mandatoryKeys = Object.keys (this.children);
        for (var i=0,j=mandatoryKeys.length; i<j; i++) {
            var mandatoryKey = mandatoryKeys[i];
            var childSchema = this.children[mandatoryKey];
            if (Object.hasOwnProperty.call (value, mandatoryKey))
                continue;

            var subtarget = Object.hasOwnProperty.call (target, mandatoryKey) ?
                target[mandatoryKey]
              : undefined
              ;
            if (Object.hasOwnProperty.call (childSchema.constraints, 'default'))
                subtarget = target[mandatoryKey] = childSchema.transform (
                    subtarget,
                    clone (childSchema.constraints.default),
                    root,
                    errMessage
                );

            if (childSchema.constraints.fill || childSchema.constraints.list)
                subtarget = target[mandatoryKey] = childSchema.accumulate (
                    subtarget,
                    undefined,
                    root
                );

            if (subtarget === undefined && !childSchema.constraints.optional)
                throw errMessage || 'final Object is incomplete';
        }

        // unresolved .exists
        if (exists && exists.length)
            throw errMessage || 'could not resolve a .exists constraint';

        return target;
    },
    array:      function (target, value, root, errMessage) {
        // .inject
        if (this.constraints.inject) {
            // shallow clone the value
            var newVal = [];
            newVal.push.apply (newVal, value);
            value = newVal;
            for (var i=0,j=this.constraints.inject.length; i<j; i++) {
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

        if (this.constraints.filter || (this.constraints.sort && this.constraints.sequence)) {
            // shallow clone value
            var newValue = [];
            newValue.push.apply (newValue, value);
            value = newValue;
        }

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

        // .sort and .sequence
        if (this.constraints.sort && this.constraints.sequence) {
            value.sort (this.constraints.sort);
            target.sort (this.constraints.sort);
        }

        // .max
        if (
            this.constraints.maxVals
         && value.length + target.length > this.constraints.maxVals
         && !this.constraints.clip
        )
            throw errMessage || 'new Array data exceeds maximum length';

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

        if (
            this.constraints.sequence
         || ( this.constraints.all && this.constraints.all.hasTransform)
         || this.constraints.filter
        ) {
            for (var i=0,j=value.length; i<j; i++) {
                var childValue = value[i];

                // .filter
                if (this.constraints.filter) {
                    var filter = this.constraints.filter;
                    if ((function(){
                        try {
                            filter.validate (childValue, errMessage);
                        } catch (err) { return true; }
                    })()) {
                        value.splice (i, 1);
                        i--; j--;
                        continue;
                    }
                }

                // .all
                if (this.constraints.all && this.constraints.all.hasTransform)
                    target[i] = this.constraints.all.transform (
                        target[i],
                        childValue,
                        undefined,
                        errMessage
                    );

                // .sequence
                if (this.constraints.sequence)
                    if (this.constraints.sequence[i]) {
                        target[i] = this.constraints.sequence[i].transform (
                            target[i],
                            childValue,
                            undefined,
                            errMessage
                        );
                    } else if (this.constraints.extras)
                        target[i] = this.constraints.extras.transform (
                            target[i],
                            childValue,
                            undefined,
                            errMessage
                        );
                    else
                        throw errMessage || 'found unexpected array item';

                if (exists)
                    // .exists
                    for (var k=0,l=exists.length; k<l; k++)
                        (function(){
                            try {
                                exists[k].validate (target[i], errMessage);
                                if (!--existsLives[k]) {
                                    exists.splice (k, 1);
                                    existsLives.splice (k, 1);
                                    k--; l--;
                                }
                            } catch (err) { /* nobody cares */ }
                        })();
            }
        }

        if (this.constraints.insert) {
            // man is splice ever an ugly api
            var jobVal = [ this.constraints.insert, 0 ];
            jobVal.push.apply (jobVal, value);
            target.splice.apply (target, jobVal);
        } else if (this.constraints.append)
            target.push.apply (target, value);
        else if (this.constraints.prepend) // prepend
            target.unshift.apply (target, value);
        else if (!this.constraints.all && !this.constraints.sequence) {
            target.splice (0, target.length); // drops all elements from target
            target.push.apply (target, value);
            if (this.constraints.clip)
                if (this.constraints.clip >= 0)
                    target.splice (this.constraints.clip, target.length);
                else
                    target.splice (0, Math.max (0, target.length + this.constraints.clip));
        }

        // .exists
        if (exists) {
            for (var i=0,j=exists.length; i<j; i++)
                for (var k=0,l=target.length; k<l; k++)
                    if ( (function(){
                        try {
                            exists[i].validate (target[k], errMessage);
                            if (!--existsLives[i]) {
                                exists.splice (i, 1);
                                existsLives.splice (i, 1);
                                i--; j--;
                                return true;
                            }
                        } catch (err) { return false; }
                    })() )
                        break;
            if (exists.length) {
                throw errMessage || 'result document does not pass all .exists constraints';
            }
        }

        // .sort WITHOUT .sequence
        if (this.constraints.sort && !this.constraints.sequence) {
            target.sort (this.constraints.sort);
        }

        if (this.constraints.clip) {
            if (this.constraints.clip >= 0)
                target.splice (this.constraints.clip, target.length);
            else
                target.splice (0, Math.max (0, target.length + this.constraints.clip));
        }

        // min
        if (this.constraints.minVals !== undefined && value.length < this.constraints.minVals)
            throw errMessage || 'too few keys on Object';

        // max
        if (this.constraints.maxVals !== undefined && value.length > this.constraints.maxVals)
            throw errMessage || 'too many keys on Object';

        // length
        if (this.constraints.valCount !== undefined && value.length != this.constraints.valCount)
            throw errMessage || 'too many keys on Object';

        return target;
    },
    string:     function (target, value, root, errMessage) {
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
            for (var i=0,j=this.constraints.inject.length; i<j; i++) {
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

        var len = resultStr.length;

        // format
        if (this.constraints.format)
            validateFormat (this.constraints.format, resultStr)

        // min
        if (this.constraints.minLength !== undefined && len < this.constraints.minLength)
            throw errMessage || 'String length below minimum';

        // max
        if (this.constraints.maxLength !== undefined && len > this.constraints.maxLength)
            throw errMessage || 'String length above maximum';

        // exact length
        if (this.constraints.length !== undefined && len != this.constraints.length)
            throw errMessage || 'String is incorrect length';

        // regex matching
        if (this.constraints.match !== undefined && !this.constraints.match.test (resultStr))
            throw errMessage || 'String did not match expression';

        return resultStr;
    },
    number:     function (target, value, root, errMessage) {
        if (this.constraints.normal)
            value = value / this.constraints.normal;
        else if (this.constraints.modFilter)
            value = value % this.constraints.modFilter;

        if (this.constraints.inverse)
            value = -1 * value;
        if (this.constraints.reciprocal)
            value = 1 / value;

        if (this.constraints.multiply)
            value = ( target || 0 ) * value;
        else if (this.constraints.divide)
            value = ( target || 0 ) / value;
        else if (this.constraints.add)
            value = ( target || 0 ) + value;
        else if (this.constraints.subtract)
            value = ( target || 0 ) - value;
        else if (this.constraints.average && target !== undefined)
            if (typeof this.constraints.average == 'number')
                if (this.constraints.average > 1)
                    value = target + ((value - target) / this.constraints.average)
                else
                    value = target + ((value - target) * this.constraints.average)
            else
                value = (target + value) / 2;

        this.validate (value, errMessage);
        return value;
    },
    boolean:    function (target, value, root, errMessage) {
        if (this.constraints.inverse)
            value = !value;

        return value;
    },
    null:       function (target, value, root, errMessage) {
        return value;
    }
};

module.exports = TYPE_TRANSFORMERS;
