

/**     @member/Function likeness#accumulate

*/
var RE_PATH = /([^\\](?:\\\\)*)\//g;
function accumulate (/* target, value, path, root */) {
    var target, value, path, root;
    switch (arguments.length) {
        case 4:
            root = arguments[3];
        case 3:
            path = arguments[2];
        case 2:
            value = arguments[1];
        default:
            target = arguments[0];
    }
    path = path || this.path;
    root = root || value;

    // resolve values by path and accumulate
    var values = [];
    var sources = this.constraints.fill || this.constraints.list;
    for (var i=0,j=sources.length; i<j; i++) {
        var source = sources[i];

        if (typeof source != 'string') {
            values.push (source.accumulate (undefined, undefined,  path, root));
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

    if (this.constraints.list) {
        // we want the original value, too
        if (value !== undefined)
            values.unshift (value);
        var result = this.transform (target, values, path, root);
        console.log ('accumulated .list', values, 'to', result);
        return result;
    }

    // if the value already exists, it must be applied first
    if (value !== undefined)
        target = this.transform (target, value, path, root);
    // apply each value
    for (var i=0,j=values.length; i<j; i++)
        target = this.transform (target, values[i], path, root);
    return target;
}


module.exports = accumulate;
