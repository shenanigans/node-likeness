
var Set = require ('./Set');
var getTypeStr = require ('./GetTypeStr');
var ValidationError = require ('./errors').ValidationError;
var validateFormat = require ('./Format').validate;

var TYPE_VALIDATORS = {
    object:     function (value) {
        var keys = Object.keys (value);
        var len = keys.length;
        var remaining = {};
        for (var key in this.children)
            remaining[key] = true;

        // minKeys
        if (this.constraints.minKeys !== undefined && len < this.constraints.minKeys)
            throw new Error ('too few keys on Object');

        // maxKeys
        if (this.constraints.maxKeys !== undefined && len > this.constraints.maxKeys)
            throw new Error ('too many keys on Object');

        // keyCount
        if (this.constraints.keyCount !== undefined && len != this.constraints.keyCount)
            throw new Error ('Object key count is incorrect');

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
                throw new Error ('duplicate property');
            }
            delete remaining[name];
            if (Object.hasOwnProperty.call (this.children, name))
                this.children[name].validate (childValue)
            else
                // unknown key
                if (this.constraints.keyTest) {
                    return this.constraints.keyTest.validate (name, postValidate)
                } else {
                    if (this.constraints.matchChildren) {
                        var found = false;
                        for (var i=0,j=this.constraints.matchChildren.length; i<j; i++) {
                            var candidate = this.constraints.matchChildren[i];
                            if (candidate.pattern.test (name)) {
                                candidate.validate (childValue);
                                found = true;
                                break;
                            }
                        }
                        if (!found)
                            if (this.constraints.extras)
                                this.constraints.extras.validate (childValue);
                            else if (this.constraints.keyFormat)
                                validateFormat (this.constraints.keyFormat, name);
                            else if (!this.constraints.adHoc)
                                throw new Error ('found unknown key');
                    } else if (this.constraints.extras)
                        this.constraints.extras.validate (childValue);
                    else if (this.constraints.keyFormat)
                        validateFormat (this.constraints.keyFormat, name);
                    else if (!this.constraints.adHoc)
                        throw new Error ('found unknown key');
                }

            // .exists
            if (exists)
                for (var i=0,j=exists.length; i<j; i++)
                    (function(){
                        try {
                            exists[i].validate (childValue)
                            if (!--existsLives[i]) {
                                exists.splice (i, 1);
                                existsLives.splice (i, 1);
                                i--; j--;
                            }
                        } catch (err) { /* .exists did not match */ }
                    })();

            // .all
            if (this.constraints.all)
                this.constraints.all.validate (childValue);
        }
        // unresolved .exists
        if (exists && exists.length)
            throw new Error ('could not resolve a .exists constraint');

        // missing keys?
        var leftovers = Object.keys (remaining);
        if (leftovers.length)
            for (var i=0,j=leftovers.length; i<j; i++)
                if (!this.children[leftovers[i]].constraints.optional)
                    throw new Error ('Object incomplete');

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
                            throw new Error ('key depencies not met for key ' + depKeys[i]);
                }
            } else
                // keys depend on schema
                for (var i=0,j=depKeys.length; i<j; i++)
                    if (Object.hasOwnProperty.call (value, depKeys[i]))
                       this.constraints.dependencies[depKeys[i]].validate (value);
        }
    },
    array:      function (value) {
        var self = this;
        var len = value.length;
        // minVals
        if (this.constraints.minVals !== undefined && len < this.constraints.minVals)
            throw new Error ('Array length below minimum');

        // maxVals
        if (this.constraints.maxVals !== undefined && len > this.constraints.maxVals)
            throw new Error ('Array length above maximum');

        // valCount
        if (this.constraints.valCount !== undefined && len != this.constraints.valCount)
            throw new Error ('Array length is incorrect');

        if (this.constraints.unique) {
            var set = new Set (value);
            if (set.count != value.length)
                throw new Error ('duplicate value found among unique set');
        }

        if (this.constraints.sort && value.length > 1) {
            var first = value[0];
            for (var i=1,j=value.length; i<j; i++) {
                var next = value[i];
                if (this.constraints.sort (first, next) > 0) {
                    throw new Error ('items in incorrect order');
                }
                first = next;
            }
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
                        exists[k].validate (childValue);
                        if (!--existsLives[k]) {
                            exists.splice (k, 1);
                            existsLives.splice (k, 1);
                            k--; l--;
                        }
                    } catch (err) { /* nobody cares */ }
                })();

            // .all
            if (this.constraints.all)
                this.constraints.all.validate (childValue);

            // .sequence
            if (this.constraints.sequence)
                if (this.constraints.sequence[i])
                    this.constraints.sequence[i].validate (childValue);
                else if (this.constraints.extras)
                    this.constraints.extras.validate (childValue);
                else
                    throw new Error ('found unexpected array item');

            // .extra
            if (this.constraints.extras && !this.constraints.all && !this.constraints.sequence)
                this.constraints.extras.validate (childValue);
        }

        // unresolved .exists
        if (exists && exists.length)
            throw new Error ('could not resolve a .exists constraint');
    },
    string:     function (value) {
        var len = value.length;

        // format
        if (this.constraints.format)
            validateFormat (this.constraints.format, value)

        if (this.constraints.length !== undefined && len != this.constraints.length)
            throw new Error ('String length is incorrect');

        // min
        if (this.constraints.minLength !== undefined && len < this.constraints.minLength)
            throw new Error ('String length below minimum');

        // max
        if (this.constraints.maxLength !== undefined && len > this.constraints.maxLength)
            throw new Error ('String length above maximum');

        // exact length
        if (this.constraints.length !== undefined && len != this.constraints.length)
            throw new Error ('String is incorrect length');

        // regex matching
        if (this.constraints.match !== undefined && !this.constraints.match.test (value))
            throw new Error ('String did not match expression');
    },
    number:     function (value) {
        // min
        if (this.constraints.gte !== undefined && value < this.constraints.gte)
            throw new Error ('Number value below minimum');

        // exclusiveMin
        if (this.constraints.gt !== undefined && value <= this.constraints.gt)
            throw new Error ('Number value equal to or below minimum limit');

        // max
        if (this.constraints.lte !== undefined && value > this.constraints.lte)
            throw new Error ('Number value above maximum');

        // exclusiveMax
        if (this.constraints.lt !== undefined && value >= this.constraints.lt)
            throw new Error ('Number value equal to or above maximum limit');

        // modulo
        if (this.constraints.modulo !== undefined) {
            var divisor = this.constraints.modulo[0];
            var remainder = this.constraints.modulo[1];
            if (value % divisor == remainder)
                return;
            throw new Error ('Number does not meet modulo constraint');
        }

        // multiple
        if (this.constraints.multiple && value % this.constraints.multiple)
            throw new Error ('Number was not an appropriate multiple');
    }
};

module.exports = TYPE_VALIDATORS;
