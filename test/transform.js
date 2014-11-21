
var Likeness = require ('../Likeness');

var typeGetter = ({}).toString;
try { Buffer; } catch (err) { Buffer = function(){}; }
function getTypeStr (obj) {
    var tstr = typeGetter.apply(obj).slice(8,-1).toLowerCase();
    if (tstr == 'object')
        if (obj instanceof Buffer) return 'buffer';
        else return tstr;
    if (tstr == 'text') return 'textnode';
    if (tstr == 'comment') return 'commentnode';
    if (tstr.slice(0,4) == 'html') return 'element';
    return tstr;
}

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
    return able == baker;
}

function testTransform (schema, source, target, goal, callback) {
    schema = new Likeness (schema);
    if (callback)
        try {
            return schema.transform (source, target, function (err, val) {
                if (err)
                    return callback (new Error (JSON.stringify (err)));
                if (!deepCompare (val, goal))
                    return callback (new Error ('goal did not match.\n'+JSON.stringify (val)));
                callback();
            });
        } catch (err) {
            return callback (new Error (JSON.stringify (err)));
        }

    try {
        schema.transform (source, target);
        if (!deepCompare (target, goal))
            throw new Error ('goal did not match.\n'+JSON.stringify (target));
    } catch (err) {
        throw new Error (JSON.stringify (err));
    }
}

function testTransformFailure (schema, source, target, error, callback) {
    schema = new Likeness (schema);
    if (callback)
        try {
            return schema.transform (source, target, function (err, val) {
                if (err)
                    return callback (new Error (JSON.stringify (err)));
                if (!deepCompare (val, goal))
                    return callback (new Error ('goal did not match.\n'+JSON.stringify (val)));
                callback();
            });
        } catch (err) {
            return callback (new Error (JSON.stringify (err)));
        }

    try {
        schema.transform (source, target);
        if (!deepCompare (target, goal))
            throw new Error ('goal did not match.\n'+JSON.stringify (target));
    } catch (err) {
        throw new Error (JSON.stringify (err));
    }
}

describe ("arbitrary, Synchronous", function(){

});

describe ("arbitrary, Asynchronous", function(){

});

describe ("optional, Synchronous", function(){

});

describe ("optional, Asynchronous", function(){

});

describe ("simple constraints, Synchronous", function(){

});

describe ("type", function(){

});

describe ("eval/async", function(){

});

describe ("Object min/max/length", function(){

});

describe ("Array min/max/length", function(){

});

describe ("String length/match", function(){

});

describe ("Numbers min/max/modulo", function(){

});

describe ("simple constraints, Asynchronous", function(){

});

describe ("type", function(){

});

describe ("eval/async", function(){

});

describe ("Object min/max/length", function(){

});

describe ("Array min/max/length", function(){

});

describe ("String length/match", function(){

});

describe ("Numbers min/max/modulo", function(){

});

describe ("predicate constraints, Synchronous", function(){

});

describe ("Objects with .all", function(){

});

describe ("Objects with single .exists", function(){

});

describe ("Objects with .exists and .times", function(){

});

describe ("Objects with .all and multiple .exists", function(){

});

describe ("Arrays with .all", function(){

});

describe ("Arrays with .exists and .times", function(){

});

describe ("Arrays with .all and .exists", function(){

});

describe ("predicate constraints, Asynchronous", function(){

});

describe ("Objects with .all", function(){

});

describe ("Objects with single .exists", function(){

});

describe ("Objects with .exists and .times", function(){

});

describe ("Objects with .all and multiple .exists", function(){

});

describe ("Arrays with .all", function(){

});

describe ("Arrays with .exists and .times", function(){

});

describe ("Arrays with .all and .exists", function(){

});
