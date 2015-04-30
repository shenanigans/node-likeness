
var getTypeStr = require ('./GetTypeStr');

/**     @module likeness.Sorting
    @development
    Tools for sorting and comparing documents.
*/

var ARR_SORT_PRIORITY = [
    'null', 'number', 'integer', 'string', 'object', 'array', 'boolean'
];
var SORT_PRIORITY = {};
for (var i in ARR_SORT_PRIORITY) SORT_PRIORITY[ARR_SORT_PRIORITY[i]] = i;


/**     @property/Function getLeafSort
    Creates a simple sort function closing on the provided direction. Documents are compared
    according to the [MongoDB sorting spec]
    (http://docs.mongodb.org/manual/reference/method/cursor.sort/).
@argument/Number sspec
    The direction, `1` or `-1` to sort.
@returns/Function
    A Function suitable for use with [standard sorting](Array#sort).
*/
function getLeafsort (sspec) {
    sspec = Math.max (-1, Math.min (1, sspec)) * -1;
    function leafsort (able, baker) {
        if (able === baker) return 0;
        var aType = getTypeStr (able);
        var bType = getTypeStr (baker);
        if (aType != bType)
            return Math.max (-1, Math.min (1,
                sspec * (SORT_PRIORITY[bType] - SORT_PRIORITY[aType])
            ));
        if (aType == 'number')
            return Math.max (-1, Math.min (1, sspec * (baker - able)));
        if (aType == 'string')
            if (baker > able)
                return sspec;
            else
                return -1 * sspec;
        if (aType == 'object') {
            var aKeys = Object.keys (able);
            var bKeys = Object.keys (baker);
            for (var i in bKeys) {
                if (aKeys[i] == bKeys[i]) { // recurse
                    var comp = leafsort (able[bKeys[i]], baker[bKeys[i]]);
                    if (comp) return comp;
                } else if (bKeys[i] > aKeys[i])
                    return sspec;
                else
                    return -1 * sspec;
            }
            return Math.max (-1, Math.min (1, sspec * (bKeys.length - aKeys.length)));
        }
        if (aType == 'array') {
            if (!able.length)
                if (baker.length) return -1;
                else return 0;
            if (!baker.length)
                if (able.length) return 1;
                else return 0;
            if (sspec < 0) { // find highest
                var aHighest = able[0];
                var bHighest = baker[0];
                for (var i=1,j=able.length; i<j; i++) // recurse
                    if (sspec * leafsort (aHighest, able[i]) > 0)
                        aHighest = able[i];
                for (var i=1,j=baker.length; i<j; i++) // recurse
                    if (sspec * leafsort (bHighest, baker[i]) > 0)
                        bHighest = baker[i];
                // recurse
                return leafsort (aHighest, bHighest);
            } else { // find lowest
                var aLowest = able[0];
                var bLowest = baker[0];
                for (var i=1,j=able.length; i<j; i++) // recurse
                    if (sspec * leafsort (aLowest, able[i]) < 0)
                        aLowest = able[i];
                for (var i=1,j=baker.length; i<j; i++) // recurse
                    if (sspec * leafsort (bLowest, baker[i]) < 0)
                        bLowest = baker[i];
                // recurse
                return leafsort (aLowest, bLowest);
            }
        }
        // all other types are considered indistinguishable to sort
        return 0;
    }

    return leafsort;
}


/**     @property/Function getDocSort
    Creates a complex sort function closing on the provided specification document. Documents are
    compared according to the specification.
@argument/Object sspec
    A map of dot-delimited paths to Number directions (`1` or `-1`).
@returns/Function
    A Function suitable for use with [standard sorting](Array#sort).
*/
function getDocsort (sspec) {
    var leafsort = getLeafsort (1);
    var specPaths = [];
    var specFullpaths = Object.keys (sspec);
    for (var key in sspec)
        if (key.match (/\$/))
            throw new Error ('invalid sort path '+key);
        else
            specPaths.push (key.split ('.'));

    return function (able, baker) {
        for (var i in specPaths) {
            var path = specPaths[i];
            var aPointer = able;
            var bPointer = baker;
            var direction = sspec[specFullpaths[i]] > 0 ? 1 : -1;
            for (var j in path) {
                var frag = path[j];
                if (!Object.hasOwnProperty.call (able, frag))
                    if (Object.hasOwnProperty.call (baker, frag))
                        return direction;
                    else continue;
                if (!Object.hasOwnProperty.call (baker, frag))
                    if (Object.hasOwnProperty.call (able, frag))
                        return -1 * direction;
                    else continue;
                aPointer = aPointer[frag];
                bPointer = bPointer[frag];
            }
            var comp = direction * leafsort (aPointer, bPointer);
            if (comp) return comp;
        }
        return 0;
    };
}


/**     @property/Function matchLeaves
    Compare two documents for deep equality.
@argument able
@argument baker
@returns/Boolean isEqual
*/
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
    } else if (aType == 'object') {
        var keys = Object.keys (able);
        if (keys.length != Object.keys (baker).length) return false;
        for (var i in keys) {
            var key = keys[i];
            if (!Object.hasOwnProperty.call (baker, key) || !matchLeaves (able[key], baker[key]))
                return false;
        }
        return true;
    } else return false;
}

module.exports.getLeafsort = getLeafsort;
module.exports.getDocsort = getDocsort;
module.exports.matchLeaves = matchLeaves;
