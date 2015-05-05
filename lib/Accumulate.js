
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

*/
var RE_PATH = /([^\\](?:\\\\)*)\//g;
function accumulate (/* target, value, path, root, errContext */) {
    var target, value, path, root, errContext;
    if (arguments.length == 1)
        value = arguments[0];
    else {
        errContext = arguments[4];
        root = arguments[3];
        path = arguments[2];
        value = arguments[1];
        target = arguments[0];
    }
    path = path || this.path;
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
            values.push (source.accumulate (undefined, undefined,  path, root, errMessage));
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
                    [],
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
                    [],
                    values[i],
                    errMessage
                );

        return values;
    }

    if (this.constraints.list) {
        // we want the original value, too
        if (value !== undefined)
            values.unshift (value);
        var result = this.transform (target, values, path, root, errMessage);
        return result;
    }

    // if the value already exists, it must be applied first
    if (value !== undefined)
        target = this.transform (target, value, path, root, errMessage);
    // apply each value
    for (var i=0,j=values.length; i<j; i++)
        target = this.transform (target, values[i], path, root, errMessage);

    return target;
}


module.exports = accumulate;
