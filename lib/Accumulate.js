
var getTypeStr = require ('./GetTypeStr');

function deepCompare (able, baker) {
    if (able === baker) return true;
    var type = getTypeStr (able);
    if (type != getTypeStr (baker)) return false;
    if (type == 'object' || type == 'array') {
        if (Object.keys (able).length != Object.keys (baker).length) return false;
        for (var key in able)
            if (!deepCompare (able[key], baker[key])) return false;
        return true;
    }
    if (
        type == 'regexp'
     && able.toString() == baker.toString()
     && able.global == baker.global
     && able.multiline == baker.multiline
    )
        return true;
    return able == baker;
}

/**     @member/Function likeness#accumulate
    Process the accumulator constraints on this node level and return a value appropriate to the
    type of accumulation specified. First the source paths are resolved into an Array containing
    every value matching every path, parallellized by every Array encountered. The final returned
    result is one of:
     * A single value resulting from [transforming](likeness#transform) the original value by each
        source value.
     * An Array of every source value found, starting with the original value.
     * An Array of Arrays of values, grouped by selecting values who produce identical values when
        transformed by the `.groupTransform` transformer.
@argument target
    @optional
    The existing value at this node in the target document.
@argument value
    The document value at this node in the source document.
@argument root
    @optional
    The root of the document where accumulator constraints should search for values.
@argument errContext
    @optional
    If an upstream `.error` has been configured, it is passed here in case it needs to be thrown.
*/
var RE_PATH = /([^\\](?:\\\\)*)\//g;
function accumulate (/* target, value, root, errContext */) {
    var target, value, root, errContext;
    if (arguments.length == 1)
        value = arguments[0];
    else {
        errContext = arguments[3];
        root = arguments[2];
        value = arguments[1];
        target = arguments[0];
    }
    if (root === undefined)
        root = value;
    var errMessage = this.constraints.error || errContext;

    // resolve values by path and accumulate
    var values = [];
    var sources = this.constraints.fill || this.constraints.list;
    // var select = this.constraints.select;
    for (var i=0,j=sources.length; i<j; i++) {
        var source = sources[i];

        if (typeof source != 'string') {
            values.push (source.accumulate (undefined, undefined, root, errMessage));
            continue;
        }

        var pathFrags = source.split (RE_PATH);
        var path = [];
        for (var k=0,l=pathFrags.length-1; k<l; k+=2)
            path.push (pathFrags[k] + pathFrags[k+1]);
        path.push (pathFrags[pathFrags.length-1]);

        var pointer = root;
        var stillGoing = true;
        for (var k=0,l=path.length; k<l; k++) {
            var step = path[k];
            if (typeof pointer != 'object') { // cannot resolve, non-conformant schema
                stillGoing = false;
                break;
            }
            if (!(pointer instanceof Array)) {
                if (!Object.hasOwnProperty.call (pointer, step)) { // cannot resolve, value missing
                    stillGoing = false;
                    break;
                }
                pointer = pointer[step];
                continue;
            }
            (function parallelize (level, path, pointer) {
                for (var p=0,q=pointer.length; p<q; p++) {
                    var subPointer = pointer[p];
                    var subStillGoing = true;
                    for (var k=level, l=path.length; k<l; k++) {
                        step = path[k];
                        if (typeof subPointer != 'object') {
                            subStillGoing = false;
                            break;
                        }
                        if (subPointer instanceof Array) {
                            parallelize (k, path, subPointer);
                            subStillGoing = false;
                            break;
                        }
                        if (!Object.hasOwnProperty.call (subPointer, step)) {
                            subStillGoing = false;
                            break;
                        }
                        subPointer = subPointer[step];
                    }
                    if (subStillGoing)
                        values.push (subPointer);
                }
            }) (k, path, pointer);
            stillGoing = false;
            break;
        }
        if (stillGoing)
            values.push (pointer);
    }

    if (this.constraints.group) {
        var ids = [];
        var allVals = [];
        for (var i=0,j=values.length; i<j; i++)
            allVals.push.apply (allVals, values[i]);
        for (var i=0,j=allVals.length; i<j; i++)
            ids.push (
                this.constraints.group.accumulate (
                    undefined,
                    undefined,
                    allVals[i],
                    errMessage
                )
            );


        var groupIDs = [];
        var groups = [];
        for (var i=0,j=ids.length; i<j; i++) {
            var id = ids[i];
            var found = false;
            for (var k=0,l=groupIDs.length; k<l; k++)
                if (deepCompare (id, groupIDs[k])) {
                    found = true;
                    groups[k].push (allVals[i]);
                    break;
                }
            if (!found) {
                groupIDs.push (id);
                groups.push ([ allVals[i] ]);
            }
        }
        values = groups;

        if (this.constraints.groupTransform)
            for (var i=0,j=values.length; i<j; i++)
                values[i] = this.constraints.groupTransform.accumulate (
                    undefined,
                    undefined,
                    values[i],
                    errMessage
                );

        return values;
    }

    if (this.constraints.list) {
        // we want the original value, too
        if (value !== undefined)
            values.unshift (value);
        var result = this.transform (target, values, root, errMessage);
        return result;
    }

    // if the value already exists, it must be applied first
    if (value !== undefined)
        target = this.transform (target, value, root, errMessage);
    // apply each value
    for (var i=0,j=values.length; i<j; i++)
        target = this.transform (target, values[i], root, errMessage);

    return target;
}


module.exports = accumulate;
