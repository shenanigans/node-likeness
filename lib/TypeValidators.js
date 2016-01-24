
var Set = require ('./Set');
var getTypeStr = require ('./GetTypeStr');
var validateFormat = require ('./Format').validate;

var TYPE_VALIDATORS = {
    object:     function (value, errMessage) {
        var keys = Object.keys (value);
        var len = keys.length;
        var remaining = {};
        for (var key in this.children)
            remaining[key] = true;

        // minKeys
        if (this.constraints.minKeys !== undefined && len < this.constraints.minKeys)
            throw errMessage || 'too few keys on Object';

        // maxKeys
        if (this.constraints.maxKeys !== undefined && len > this.constraints.maxKeys)
            throw errMessage || 'too many keys on Object';

        // keyCount
        if (this.constraints.keyCount !== undefined && len != this.constraints.keyCount)
            throw errMessage || 'Object key count is incorrect';

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

        var uniqueSet;
        if (this.constraints.unique)
            uniqueSet = new Set();

        //
        // children
        var valueKeys = Object.keys (value);
        for (var nameI=0,nameCount = valueKeys.length; nameI<nameCount; nameI++) {
            var name = valueKeys[nameI];
            var childValue = value[name];
            if (uniqueSet && !uniqueSet.add (childValue)) {
                throw errMessage || 'duplicate property';
            }
            delete remaining[name];
            if (Object.hasOwnProperty.call (this.children, name))
                this.children[name].validate (childValue, errMessage)
            else
                // unknown key
                if (this.constraints.keyTest) {
                    return this.constraints.keyTest.validate (name, errMessage)
                } else {
                    if (this.constraints.matchChildren) {
                        var found = false;
                        for (var i=0,j=this.constraints.matchChildren.length; i<j; i++) {
                            var candidate = this.constraints.matchChildren[i];
                            if (candidate.pattern.test (name)) {
                                candidate.validate (childValue, errMessage);
                                found = true;
                                break;
                            }
                        }
                        if (!found)
                            if (this.constraints.extras)
                                this.constraints.extras.validate (childValue, errMessage);
                            else if (this.constraints.keyFormat)
                                validateFormat (this.constraints.keyFormat, name);
                            else if (!this.constraints.adHoc)
                                throw errMessage || 'found unknown key';
                    } else if (this.constraints.extras)
                        this.constraints.extras.validate (childValue, errMessage);
                    else if (this.constraints.keyFormat)
                        validateFormat (this.constraints.keyFormat, name);
                    else if (!this.constraints.adHoc)
                        throw errMessage || 'found unknown key';
                }

            // .exists
            if (exists)
                for (var i=0,j=exists.length; i<j; i++)
                    (function(){
                        try {
                            exists[i].validate (childValue, errMessage)
                            if (!--existsLives[i]) {
                                exists.splice (i, 1);
                                existsLives.splice (i, 1);
                                i--; j--;
                            }
                        } catch (err) { /* .exists did not match */ }
                    })();

            // .all
            if (this.constraints.all)
                this.constraints.all.validate (childValue, errMessage);
        }
        // unresolved .exists
        if (exists && exists.length)
            throw errMessage || 'could not resolve a .exists constraint';

        // missing keys?
        var leftovers = Object.keys (remaining);
        if (leftovers.length)
            for (var i=0,j=leftovers.length; i<j; i++)
                if (!this.children[leftovers[i]].constraints.optional)
                    throw errMessage || 'Object incomplete';

        // dependencies?
        if (this.constraints.dependencies) {
            var depKeys = Object.keys (this.constraints.dependencies);
            if (depKeys.length && this.constraints.dependencies[depKeys[0]] instanceof Array) {
                // keys depend on arrays of keys
                for (var i=0,j=depKeys.length; i<j; i++) {
                    if (!Object.hasOwnProperty.call (value, depKeys[i]))
                        continue;
                    var required = this.constraints.dependencies[depKeys[i]];
                    for (var k=0,l=required.length; k<l; k++)
                        if (!Object.hasOwnProperty.call (value, required[k]))
                            throw errMessage || 'key depencies not met for key ' + depKeys[i];
                }
            } else
                // keys depend on schema
                for (var i=0,j=depKeys.length; i<j; i++)
                    if (Object.hasOwnProperty.call (value, depKeys[i]))
                       this.constraints.dependencies[depKeys[i]].validate (value, errMessage);
        }
    },
    array:      function (value, errMessage) {
        var self = this;
        var len = value.length;

        // minVals
        if (this.constraints.minVals !== undefined && len < this.constraints.minVals)
            throw errMessage || 'Array length below minimum';

        // maxVals
        if (this.constraints.maxVals !== undefined && len > this.constraints.maxVals)
            throw errMessage || 'Array length above maximum';

        // valCount
        if (this.constraints.valCount !== undefined && len != this.constraints.valCount)
            throw errMessage || 'Array length is incorrect';

        if (this.constraints.unique) {
            var set = new Set (value);
            if (set.count != value.length)
                throw errMessage || 'duplicate value found among unique set';
        }

        if (this.constraints.sort && value.length > 1) {
            var sorter = this.constraints.sort;
            var first = value[0];
            (function(){
                try {
                    var valid = true;
                    for (var i=1,j=value.length; i<j; i++) {
                        var next = value[i];
                        if (sorter (first, next) > 0) {
                            valid = false;
                            break;
                        }
                        first = next;
                    }
                } catch (err) {
                    throw errMessage || 'unsortable Array item';
                }
                if (!valid)
                    throw errMessage || 'items in incorrect order';
            })();
        }

        if (
            !this.constraints.exists
         && !this.constraints.all
         && !this.constraints.extras
         && !this.constraints.sequence
        )
            return;

        // clone .exists, so we can sweep it as we go
        var exists = [];
        var existsLives = [];
        if (this.constraints.exists) for (var i=0,j=this.constraints.exists.length; i<j; i++) {
            exists.push (this.constraints.exists[i]);
            existsLives.push (this.constraints.exists[i].constraints.times || 1);
        }

        for (var i=0,j=value.length; i<j; i++) {
            var childValue = value[i];

            // .exists
            for (var k=0,l=exists.length; k<l; k++)
                (function(){
                    try {
                        exists[k].validate (childValue, errMessage);
                        if (!--existsLives[k]) {
                            exists.splice (k, 1);
                            existsLives.splice (k, 1);
                            k--; l--;
                        }
                    } catch (err) { /* nobody cares */ }
                })();

            // .all
            if (this.constraints.all)
                this.constraints.all.validate (childValue, errMessage);

            // .sequence
            if (this.constraints.sequence)
                if (this.constraints.sequence[i])
                    this.constraints.sequence[i].validate (childValue, errMessage);
                else if (this.constraints.extras)
                    this.constraints.extras.validate (childValue, errMessage);
                else
                    throw errMessage || 'found unexpected array item';

            // .extra
            if (this.constraints.extras && !this.constraints.all && !this.constraints.sequence)
                this.constraints.extras.validate (childValue, errMessage);
        }

        // unresolved .exists
        if (exists && exists.length)
            throw errMessage || 'could not resolve a .exists constraint';
    },
    string:     function (value, errMessage) {
        var len = Buffer.byteLength (value);

        // format
        if (this.constraints.format)
            validateFormat (this.constraints.format, value)

        if (this.constraints.length !== undefined && len != this.constraints.length)
            throw errMessage || 'String length is incorrect';

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
        if (this.constraints.match !== undefined && !this.constraints.match.test (value))
            throw errMessage || 'String did not match expression';
    },
    number:     function (value, errMessage) {
        // min
        if (this.constraints.gte !== undefined && value < this.constraints.gte)
            throw errMessage || 'Number value below minimum';

        // exclusiveMin
        if (this.constraints.gt !== undefined && value <= this.constraints.gt)
            throw errMessage || 'Number value equal to or below minimum limit';

        // max
        if (this.constraints.lte !== undefined && value > this.constraints.lte)
            throw errMessage || 'Number value above maximum';

        // exclusiveMax
        if (this.constraints.lt !== undefined && value >= this.constraints.lt)
            throw errMessage || 'Number value equal to or above maximum limit';

        // modulo
        if (this.constraints.modulo !== undefined) {
            var divisor = this.constraints.modulo[0];
            var remainder = this.constraints.modulo[1];
            if (value % divisor == remainder)
                return;
            throw errMessage || 'Number does not meet modulo constraint';
        }

        // multiple
        if (this.constraints.multiple && value % this.constraints.multiple)
            throw errMessage || 'Number was not an appropriate multiple';
    }
};

module.exports = TYPE_VALIDATORS;
