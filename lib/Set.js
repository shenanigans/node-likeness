

var getTypeStr = require ('./GetTypeStr');

function matchLeaves (able, baker) {
    if (able === baker) return true;

    var aType = getTypeStr (able);
    var bType = getTypeStr (baker);
    if (aType != bType) return false;
    if (aType == 'array') {
        if (able.length != baker.length) return false;
        for (var i in able)
            if (!matchLeaves (able[i], baker[i]))
                return false;
        return true;
    }
    if (aType == 'object') {
        var keys = Object.keys (able);
        if (keys.length != Object.keys (baker).length) return false;
        for (var i in keys) {
            var key = keys[i];
            if (!Object.hasOwnProperty.call (baker, key) || !matchLeaves (able[key], baker[key]))
                return false;
        }
        return true;
    }
    return false;
}


/**     @module/class likeness:Set
    @development
    Collects a set of unique values.
@argument/Array values
*/
function Set (values) {
    this.strings = {};
    this.nums = {};
    this.others = [];
    this.count = 0;

    if (!values) return;

    for (var i in values) {
        var val = values[i];
        var type = getTypeStr (val);
        if (type == 'string') {
            if (!Object.hasOwnProperty.call (this.strings, val)) {
                this.strings[val] = true;
                this.count++;
            }
            continue;
        } if (type == 'number') {
            if (!Object.hasOwnProperty.call (this.nums, val)) {
                this.nums[val] = true;
                this.count++;
            }
            continue;
        }
        var found = false;
        for (var j in this.others)
            if (matchLeaves (val, this.others[j])) {
                found = true;
                break;
            }
        if (!found) {
            this.others.push (val);
            this.count++;
        }
    }
}

/**     @member/Function equals
    @development
    Determine whether this Set contains the exact same collection of values as another Set.
@argument/. other
@returns/Boolean
*/
Set.prototype.equals = function (other) {
    if (this.others.length != other.others.length)
        return false;

    var strings = Object.keys (this.strings);
    var nums = Object.keys (this.nums);
    var otherStrings = Object.keys (other.strings);
    var otherNums = Object.keys (other.nums);

    if (strings.length != otherStrings.length || nums.length != otherNums.length)
        return false;

    for (var i in strings)
        if (!Object.hasOwnProperty.call (other.strings, strings[i]))
            return false;

    for (var i in nums)
        if (!Object.hasOwnProperty.call (other.nums, nums[i]))
            return false;

    for (var i in this.others) {
        var found = false;
        for (var j in other.others)
            if (matchLeaves (other.others[j], this.others[i])) {
                found = true;
                break;
            }
        if (!found)
            return false;
    }

    return true;
};


/**     @member/Function contains
    @development
    Determine whether every value in another Set is also contained in this Set.
@argument/. other
@returns/Boolean
*/
Set.prototype.contains = function (other) {
    for (var key in other.strings)
        if (!Object.hasOwnProperty.call (this.strings, key))
            return false;

    for (var key in other.nums)
        if (!Object.hasOwnProperty.call (this.nums, key))
            return false;

    for (var i in other.others) {
        var found = false;
        for (var j in this.others)
            if (matchLeaves (this.others[j], other.others[i])) {
                found = true;
                break;
            }
        if (!found) return false;
    }

    return true;
};


/**     @member/Function add
    @development
    Add a value to this Set and return whether or not the value was previously unknown.
@argument value
@returns/Boolean
    `true` if the item was added, `false` if it was already there.
*/
Set.prototype.add = function (val) {
    var type = getTypeStr (val);
    if (type == 'string') {
        if (!Object.hasOwnProperty.call (this.strings, val)) {
            this.strings[val] = true;
            return true;
        }
        return false;
    }

    if (type == 'number') {
        if (!Object.hasOwnProperty.call (this.nums, String (val))) {
            this.nums[val] = true;
            return true;
        }
        return false;
    }

    var found = false;
    for (var i=0,j=this.others.length; i<j; i++)
        if (matchLeaves (val, this.others[i])) {
            found = true;
            break;
        }
    if (!found) {
        this.others.push (val);
        return true;
    }
    return false;
};


/**     @member/Function export
    Create an Array of every value stored in this Set.
@returns/Array
    An Array of unique elements in this Set.
*/
Set.prototype.export = function(){
    var vals = Object.keys (this.strings);
    vals.push.apply (vals, Object.keys (this.nums).map (Number));
    vals.push.apply (vals, this.others);
    return vals;
};


module.exports = Set;
