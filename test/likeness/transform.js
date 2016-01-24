
var Likeness = require ('../../likeness');
var assert = require ('assert');
var async = require ('async');

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
    if (
        type == 'regexp'
     && able.toString() == baker.toString()
     && able.global == baker.global
     && able.multiline == baker.multiline
    )
        return true;
    return able == baker;
}

function testTransform (schema, source, target, goal) {
    schema = new Likeness (schema);
    var sourceStr = JSON.stringify (source);
    var targetStr = JSON.stringify (target);

    try {
        var result = schema.transform (target, source);
    } catch (err) {
        throw err;
        // throw new Error ('transform failed - '+err);
    }

    if (sourceStr != JSON.stringify (source))
        throw new Error ('transform damaged the source object');
    if (targetStr != JSON.stringify (target))
        throw new Error ('transform damaged the target object');
    if (!deepCompare (result, goal))
        throw new Error ('goal did not match - '+JSON.stringify (result));
}

function testTransformFailure (schema, source, target) {
    schema = new Likeness (schema);
    var sourceStr = JSON.stringify (source);
    var targetStr = JSON.stringify (target);

    try {
        var result = schema.transform (target, source);
        throw new Error ('transform completed erroneously');
    } catch (err) {
        if (typeof err != 'string')
            throw err;
        if (sourceStr != JSON.stringify (source))
            throw new Error ('transform damaged the source object');
        if (targetStr != JSON.stringify (target))
            throw new Error ('transform damaged the target object');
    }
}

describe ("#transform", function(){

    it ("throws custom errors from the errant child", function(){
        var schema = new Likeness ({
            able:{ '.lte':9000, '.error':"It's over nine thousand!!!!!!" }
        });
        try {
            schema.transform ({ able:9015 });
            throw new Error ('failed to reject document');
        } catch (err) {
            if (err !== "It's over nine thousand!!!!!!")
                throw new Error ('incorrect error thrown');
        }
    });

    it ("throws custom errors from the parent", function(){
        var schema = new Likeness ({
            able:{ '.error':'foo', able:{ able:{ '.lt':9000 } } }
        });
        try {
            schema.transform ({ able:{ able:{ able:9015 } } });
            throw new Error ('failed to reject document');
        } catch (err) {
            if (err !== "foo")
                throw new Error ('incorrect error thrown');
        }
    });

    it ("prefers to throw the immediate error", function(){
        var schema = new Likeness ({
            able:{ '.error':'foo', able:{ able:{ '.error':'bar', '.lt':9000 } } }
        });
        try {
            schema.transform ({ able:{ able:{ able:9015 } } });
            throw new Error ('failed to reject document');
        } catch (err) {
            if (err !== "bar")
                throw new Error ('incorrect error thrown');
        }
    });

    it ("prefers to throw the most proximate error", function(){
        var schema = new Likeness ({
            able:{ '.error':'foo', able:{ '.error':'bar', able:{ '.lt':9000 } } }
        });
        try {
            schema.transform ({ able:{ able:{ able:9015 } } });
            throw new Error ('failed to reject document');
        } catch (err) {
            if (err !== "bar")
                throw new Error ('incorrect error thrown');
        }
    });

    it ("transforms with a recursive schema", function(){
        testTransform (
            { able:{ '.optional':true, '.recurse':1 }, baker:{ '.type':'number', '.add':true } },
            {
                able:   {
                    able:   {
                        able:   {
                            able:   {
                                baker:  10
                            },
                            baker:  10
                        },
                        baker:  10
                    },
                    baker:  10
                },
                baker:  10
            },
            {
                able:   {
                    able:   {
                        able:   {
                            able:   {
                                baker:  1
                            },
                            baker:  2
                        },
                        baker:  3
                    },
                    baker:  4
                },
                baker:  5
            },
            {
                able:   {
                    able:   {
                        able:   {
                            able:   {
                                baker:  11
                            },
                            baker:  12
                        },
                        baker:  13
                    },
                    baker:  14
                },
                baker:  15
            }
        );
    });

    describe (".arbitrary", function(){

        it ('blindly duplicates an object with an arbitrary schema', function(){
            testTransform (
                { // schema
                    '.arbitrary':true
                },
                { // source
                    able:       42,
                    baker:      'BAKER',
                    charlie:    /CHARLIE/,
                    dog:        {
                        able:       9001,
                        baker:      /BAKER/
                    },
                    easy:       [ 'number nine', 'number nine', 'number nine', 'number nine' ]
                },
                { // target

                },
                { // goal
                    able:       42,
                    baker:      'BAKER',
                    charlie:    /CHARLIE/,
                    dog:        {
                        able:       9001,
                        baker:      /BAKER/
                    },
                    easy:       [ 'number nine', 'number nine', 'number nine', 'number nine' ]
                }
            );
        });

        it ('merges into the target correctly', function(){
            testTransform (
                { // schema
                    '.arbitrary':   true
                },
                { // source
                    able:       42,
                    charlie:    {
                        able:       19,
                        charlie:    'foo'
                    },
                    dog:        9001
                },
                { // target
                    able:       'zero',
                    baker:      77,
                    charlie:    {
                        able:       'fish',
                        baker:      'tank'
                    }
                },
                { // goal
                    able:       42,
                    baker:      77,
                    charlie:    {
                        able:       19,
                        baker:      'tank',
                        charlie:    'foo'
                    },
                    dog:        9001
                }
            );
        });

        it ('refuses to duplicate with empty schema', function(){
            testTransformFailure (
                { // schema

                },
                { // source
                    able:       42,
                    baker:      'BAKER',
                    charlie:    /CHARLIE/,
                    dog:        {
                        able:       9001,
                        baker:      /BAKER/
                    },
                    easy:       [ 'number nine', 'number nine', 'number nine', 'number nine' ]
                },
                { // target

                }
            );
        });

    });

    describe (".tolerant", function(){

        it ("ignores unknown keys in the input", function(){
            testTransform (
                {    // schema
                    '.tolerant':    true,
                    able:           { '.type':'number' },
                    charlie:        { '.type':'string' },
                    easy:           { '.type':'string' }
                },
                {    // source
                    able:       42,
                    baker:      9001,
                    charlie:    'bar',
                    dog:        {
                        able:       42
                    },
                    easy:       'foo'
                },
                { }, // target
                {    // goal
                    able:       42,
                    charlie:    'bar',
                    easy:       'foo'
                }
            );
        });

    });

    describe ("constraints", function(){

        describe ("type", function(){

            it ("rejects updates of mismatched type", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'Number' },
                        baker:      {'.type':'Boolean' },
                        charlie:    {'.type':'String' },
                        dog:        {'.type':'Array' },
                        easy:       {'.type':'Object' }
                    },
                    {    // source
                        able:       'forty two',
                        baker:      false,
                        charlie:    'zebra',
                        dog:        [ 9, 'O', 2, 1, 'O' ],
                        easy:       { }
                    },
                    { }
                );
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'Number' },
                        baker:      {'.type':'Boolean' },
                        charlie:    {'.type':'String' },
                        dog:        {'.type':'Array' },
                        easy:       {'.type':'Object' }
                    },
                    {    // source
                        able:       42,
                        baker:      'false',
                        charlie:    'zebra',
                        dog:        [ 9, 'O', 2, 1, 'O' ],
                        easy:       { }
                    },
                    { }
                );
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'Number' },
                        baker:      {'.type':'Boolean' },
                        charlie:    {'.type':'String' },
                        dog:        {'.type':'Array' },
                        easy:       {'.type':'Object' }
                    },
                    {    // source
                        able:       42,
                        baker:      false,
                        charlie:    11111,
                        dog:        [ 9, 'O', 2, 1, 'O' ],
                        easy:       { }
                    },
                    { }
                );
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'Number' },
                        baker:      {'.type':'Boolean' },
                        charlie:    {'.type':'String' },
                        dog:        {'.type':'Array' },
                        easy:       {'.type':'Object' }
                    },
                    {    // source
                        able:       42,
                        baker:      false,
                        charlie:    'zebra',
                        dog:        true,
                        easy:       { }
                    },
                    { }
                );
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'Number' },
                        baker:      { '.type':'Boolean' },
                        charlie:    { '.type':'String' },
                        dog:        { '.type':'Array' },
                        easy:       { '.type':'Object' }
                    },
                    {    // source
                        able:       42,
                        baker:      false,
                        charlie:    'zebra',
                        dog:        [ 9, 'O', 2, 1, 'O' ],
                        easy:       [ ]
                    },
                    { }
                );
            });

            it ("accepts updates with an array of types", function(){
                testTransform (
                    {
                        able:       { '.type':[ 'number', 'string' ] },
                        baker:      { '.type':[ 'array', 'string' ] },
                        charlie:    { '.type':[ 'number', 'array' ] },
                        dog:        { '.type':[ 'string', 'object' ], '.arbitrary':true },
                        easy:       { '.type':[ 'number', 'null' ] },
                        fox:        { '.type':[ 'boolean', 'number' ] }
                    },
                    {
                        able:       3,
                        baker:      'three',
                        charlie:    [ 'three' ],
                        dog:        { three:3 },
                        easy:       null,
                        fox:        false
                    },
                    { },
                    {
                        able:       3,
                        baker:      'three',
                        charlie:    [ 'three' ],
                        dog:        { three:3 },
                        easy:       null,
                        fox:        false
                    }
                );
            });

            it ("rejects updates of mismatched type using an array of types", function(){
                testTransformFailure (
                    {
                        able:       { '.type':[ 'array', 'string' ] },
                        baker:      { '.type':[ 'array', 'string' ] },
                        charlie:    { '.type':[ 'number', 'array' ] },
                        dog:        { '.type':[ 'string', 'object' ], '.arbitrary':true },
                        easy:       { '.type':[ 'number', 'null' ] },
                        fox:        { '.type':[ 'boolean', 'number' ] }
                    },
                    {
                        able:       3,
                        baker:      'three',
                        charlie:    [ 'three' ],
                        dog:        { three:3 },
                        easy:       null,
                        fox:        false
                    },
                    { }
                );
                testTransformFailure (
                    {
                        able:       { '.type':[ 'number', 'string' ] },
                        baker:      { '.type':[ 'array', 'number' ] },
                        charlie:    { '.type':[ 'number', 'array' ] },
                        dog:        { '.type':[ 'string', 'object' ], '.arbitrary':true },
                        easy:       { '.type':[ 'number', 'null' ] },
                        fox:        { '.type':[ 'boolean', 'number' ] }
                    },
                    {
                        able:       3,
                        baker:      'three',
                        charlie:    [ 'three' ],
                        dog:        { three:3 },
                        easy:       null,
                        fox:        false
                    },
                    { }
                );
                testTransformFailure (
                    {
                        able:       { '.type':[ 'number', 'string' ] },
                        baker:      { '.type':[ 'array', 'string' ] },
                        charlie:    { '.type':[ 'number', 'object' ], '.arbitrary':true },
                        dog:        { '.type':[ 'string', 'object' ], '.arbitrary':true },
                        easy:       { '.type':[ 'number', 'null' ] },
                        fox:        { '.type':[ 'boolean', 'number' ] }
                    },
                    {
                        able:       3,
                        baker:      'three',
                        charlie:    [ 'three' ],
                        dog:        { three:3 },
                        easy:       null,
                        fox:        false
                    },
                    { }
                );
                testTransformFailure (
                    {
                        able:       { '.type':[ 'number', 'string' ] },
                        baker:      { '.type':[ 'array', 'string' ] },
                        charlie:    { '.type':[ 'number', 'array' ] },
                        dog:        { '.type':[ 'string', 'array' ] },
                        easy:       { '.type':[ 'number', 'null' ] },
                        fox:        { '.type':[ 'boolean', 'number' ] }
                    },
                    {
                        able:       3,
                        baker:      'three',
                        charlie:    [ 'three' ],
                        dog:        { three:3 },
                        easy:       null,
                        fox:        false
                    },
                    { }
                );
                testTransformFailure (
                    {
                        able:       { '.type':[ 'number', 'string' ] },
                        baker:      { '.type':[ 'array', 'string' ] },
                        charlie:    { '.type':[ 'number', 'array' ] },
                        dog:        { '.type':[ 'string', 'object' ], '.arbitrary':true },
                        easy:       { '.type':[ 'number', 'boolean' ] },
                        fox:        { '.type':[ 'boolean', 'number' ] }
                    },
                    {
                        able:       3,
                        baker:      'three',
                        charlie:    [ 'three' ],
                        dog:        { three:3 },
                        easy:       null,
                        fox:        false
                    },
                    { }
                );
                testTransformFailure (
                    {
                        able:       { '.type':[ 'number', 'string' ] },
                        baker:      { '.type':[ 'array', 'string' ] },
                        charlie:    { '.type':[ 'number', 'array' ] },
                        dog:        { '.type':[ 'string', 'object' ], '.arbitrary':true },
                        easy:       { '.type':[ 'null', 'boolean' ] },
                        fox:        { '.type':[ 'number', 'null' ] }
                    },
                    {
                        able:       3,
                        baker:      'three',
                        charlie:    [ 'three' ],
                        dog:        { three:3 },
                        easy:       null,
                        fox:        false
                    },
                    { }
                );
            });

            it ("performs a type-appropriate transform using an array .type constraint", function(){
                testTransform (
                    { '.type':[ 'string', 'array' ], '.append':true },
                    'bar',
                    'foo',
                    'foobar'
                );
                testTransform (
                    { '.type':[ 'string', 'array' ], '.append':true },
                    [ 'bar' ],
                    [ 'foo' ],
                    [ 'foo', 'bar' ]
                );
            });

            it ("rejects a transform when source and target types are mismatched", function(){
                testTransformFailure (
                    { '.type':[ 'string', 'array' ], '.append':true },
                    'bar',
                    [ 'foo' ]
                );
                testTransformFailure (
                    { '.type':[ 'string', 'array' ], '.append':true },
                    [ 'bar' ],
                    'foo'
                );
            });

        });

        describe ("eval/async", function(){

            it ("fails when transforming with a failing .eval", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.eval':function (value) {
                            if (value === 'foobar')
                                throw new Error ('rejected!')
                        }}
                    },
                    {    // source
                        able:       'foobar'
                    },
                    { }
                );
            });

        });

        describe ("Objects", function(){

            it ("fails when transform exceeds max length", function(){
                testTransformFailure (
                    {    // schema
                        '.arbitrary':   true,
                        '.maxKeys':     3
                    },
                    {    // source
                        charlie:    'chunky',
                        dog:        7
                    },
                    {    // target
                        able:       42,
                        baker:      9001
                    }
                );
            });

            it ("fails when transform does not reach min length", function(){
                testTransformFailure (
                    {    // schema
                        '.arbitrary':   true,
                        '.minKeys':     5
                    },
                    {    // source
                        charlie:    'charlie'
                    },
                    {    // target
                        able:       'able',
                        baker:      'baker'
                    }
                );
            });

            it ("fails when transform violates exact length", function(){
                testTransformFailure (
                    {    // schema
                        '.arbitrary':   true,
                        '.keyCount':    5
                    },
                    {    // source
                        charlie:    'charlie'
                    },
                    {    // target
                        able:       'able',
                        baker:      'baker'
                    }
                );
            });

            it ("fails when mandatory children are not filled", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'string' },
                        baker:      { '.type':'string' },
                        charlie:    { '.type':'string' },
                        dog:        { '.type':'string' },
                        easy:       { '.type':'string' }
                    },
                    {    // source
                        baker:      'baker',
                        dog:        'dog'
                    },
                    {    // target
                        able:       'able',
                        charlie:    'baker'
                    }
                );
            });

            it ("transforms with .matchChildren", function(){
                testTransform (
                    {
                        '.matchChildren':   {
                            '^a.*':{ '.type':'number' },
                            '^b.*':{ '.type':'string' }
                        }
                    },
                    {
                        able:       32,
                        aardvark:   42,
                        baker:      'thirty-two',
                        boozahol:   'forty-two'
                    },
                    { },
                    {
                        able:       32,
                        aardvark:   42,
                        baker:      'thirty-two',
                        boozahol:   'forty-two'
                    }
                );
            });

            describe (".unique", function(){

                it ("transforms the document when .unique is satisfied", function(){
                    testTransform (
                        { '.arbitrary':true, '.unique':true },
                        { able:1, baker:'1', charlie:{ able:1 }, dog:{ able:'1' } },
                        { },
                        { able:1, baker:'1', charlie:{ able:1 }, dog:{ able:'1' } }
                    );
                });

                it ("rejects the document when .unique is not satisfied", function(){
                    testTransformFailure (
                        { '.arbitrary':true, '.unique':true },
                        { able:1, baker:'1', charlie:{ able:1 }, dog:{ able:'1' }, easy:{ able:'1' } },
                        { }
                    );
                    testTransformFailure (
                        { '.arbitrary':true, '.unique':true, '.all':{ '.type':'number' } },
                        { able:1, baker:2, charlie:2 },
                        { }
                    );
                    testTransformFailure (
                        { '.arbitrary':true, '.unique':true, '.all':{ '.type':'number' },
                            baker:{ '.gt':1 },
                            charlie:{ '.gt':1 }
                        },
                        { able:1, baker:2, charlie:2 },
                        { }
                    );
                });

            });

        });

        describe ("Arrays", function(){

            it ("fails when transform exceeds max length", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'array', '.append':true, '.maxVals':6 }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    }
                );
            });

            it ("fails when transform does not reach min length", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'array', '.append':true, '.minVals':9 }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    }
                );
            });

            it ("fails when transform violates exact length", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'array', '.append':true, '.valCount':5 }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    }
                );
            });

            it ("processes a .sequence of transforms", function(){
                testTransform (
                    { '.sequence':[
                        { '.type':'number', '.add':true },
                        { '.type':'number', '.subtract':true },
                        { '.type':'number', '.multiply':true },
                        { '.type':'number', '.divide':true }
                    ] },
                    [ 10, 10, 10, 10 ],
                    [ 100, 100, 100, 100 ],
                    [ 110, 90, 1000, 10 ]
                );
            });

            it ("fails to transform due to one failing schema in a .sequence", function(){
                testTransformFailure (
                    { '.sequence':[
                        { '.type':'number', '.add':true },
                        { '.type':'number', '.subtract':true },
                        { '.type':'number', '.multiply':true },
                        { '.type':'number', '.divide':true }
                    ] },
                    [ 10, 10, "10", 10 ],
                    [ 100, 100, 100, 100 ]
                );
            });

            it ("proceeds when .exists validates", function(){
                testTransform (
                    {
                        '.type':    'array',
                        '.append':  'true',
                        '.exists':  [
                            { '.type':'number', '.gt':10, '.times':4 }
                        ]
                    },
                    [ 12, 13, 14 ],
                    [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ],
                    [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
                );
            });

            it ("rejects when .exists does not validate", function(){
                testTransformFailure (
                    {
                        '.type':    'array',
                        '.append':  'true',
                        '.exists':  [
                            { '.type':'number', '.gt':12, '.times':4 }
                        ]
                    },
                    [ 12, 13, 14 ],
                    [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]
                );
            });

            it ("retains only unique values with .unique", function(){
                testTransform (
                    { '.unique':true, '.append':true },
                    [ 0, 1, 2, 2, 1, 2, 5, 43, 6, 45, 12, 34 ,65, 4, 2, 3, 43, 2, 5, 7 ],
                    [ 0, 1, 32, 3, 8, 43, 0, 5, 7 ],
                    [ 0, 1, 3, 5, 7, 8, 32, 43, 2, 6, 45, 12, 34, 65, 4 ]
                );
            });

        });

        describe ("Strings", function(){

            it ("fails when transform exceeds max length", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'string', '.maxLength':32 }
                    },
                    {    // source
                        able:   'This is my String. There are many like it, but this one is mine.'
                    },
                    {    // target
                        able:   'Hello, World!'
                    }
                );
            });

            it ("fails when transform does not reach min length", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'string', '.minLength':32 }
                    },
                    {    // source
                        able:   'Hello, World!'
                    },
                    {    // target
                        able:   'This is my String. There are many like it, but this one is mine.'
                    }
                );
            });

            it ("fails when transform violates exact length", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'string', '.length':13 }
                    },
                    {    // source
                        able:   'This is my String. There are many like it, but this one is mine.'
                    },
                    {    // target
                        able:   'Hello, World!'
                    }
                );
            });

        });

        describe ("Numbers", function(){

            it ("fails when transform is equal to exclusive max", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'number', '.lt':100 }
                    },
                    {    // source
                        able:   100
                    },
                    {    // target
                        able:   95
                    }
                );
            });

            it ("fails when transform is equal to exclusive min", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'number', '.gt':100 }
                    },
                    {    // source
                        able:   100
                    },
                    {    // target
                        able:   105
                    }
                );
            });

            it ("fails when transform is above max", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'number', '.lte':100 }
                    },
                    {    // source
                        able:   105
                    },
                    {    // target
                        able:   100
                    }
                );
            });

            it ("fails when transform is below min", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'number', '.gte':100 }
                    },
                    {    // source
                        able:   95
                    },
                    {    // target
                        able:   100
                    }
                );
            });

        });

    });

    describe ("transforms", function(){

        describe ("function transforms", function(){

            it ("performs a function transform", function(){
                testTransform (
                    {    // schema
                        able:   { '.type':'string', '.transform':function (target, value) {
                            return '<' + value + ' class="foo"></' + value + '>\n';
                        }}
                    },
                    {    // source
                        able:   'div'
                    },
                    { }, // target
                    {    // goal
                        able:   '<div class="foo"></div>\n'
                    }
                );
            });

            it ("combines .transform with other transforms", function(){
                testTransform (
                    {    // schema
                        able:   { '.type':'number', '.add':true, '.transform':function (target, value) {
                            return 10 * value;
                        }}
                    },
                    {    // source
                        able:   5
                    },
                    { able:50 }, // target
                    {    // goal
                        able:   100
                    }
                );
            });

            it ("constrains .transform output by type", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'string', '.transform':function (target, value) {
                            return 50
                        }}
                    },
                    {    // source
                        able:   'foo'
                    },
                    { }
                );
            });

            it ("does not constrain .transform input by type", function(){
                testTransform (
                    {    // schema
                        able:   { '.type':'string', '.transform':function (target, value) {
                            return JSON.stringify (value);
                        }}
                    },
                    {    // source
                        able:   [ 'able', 'baker', 'charlie' ]
                    },
                    { }, // target
                    {    // goal
                        able:   '["able","baker","charlie"]'
                    }
                );
            });

        });

        describe ("Numbers", function(){

            describe (".cast", function(){

                it ("casts Strings to Numbers", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.cast':true }
                        },
                        {    // source
                            able:   '9001.781'
                        },
                        { }, // target
                        {    // goal
                            able:   9001.781
                        }
                    );
                });

                it ("rejects invalid Number Strings", function(){
                    testTransformFailure (
                        {    // schema
                            able:   { '.type':'number', '.cast':true }
                        },
                        {    // source
                            able:   '9001.781a'
                        },
                        { }
                    );
                });

            });

            describe ("normalization", function(){

                it ("normalizes Numbers", function(){
                    testTransform (
                        {    // schema
                            able:   5,
                            baker:  { '.type':'number', '.normalize':10 }
                        },
                        {    // source
                            able:   3,
                            baker:  11
                        },
                        { }, // target
                        {    // goal
                            able:   3/5,
                            baker:  11/10
                        }
                    );
                });

            });

            describe ("in-place math", function(){

                it ("adds", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.add':true },
                            baker:  { '.type':'number', '.add':true }
                        },
                        {    // source
                            able:   3,
                            baker:  11
                        },
                        {    // target
                            able:   7,
                            baker:  9
                        },
                        {    // goal
                            able:   10,
                            baker:  20
                        }
                    );
                });

                it ("adds to missing target", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.add':true }
                        },
                        {    // source
                            able:   3
                        },
                        {    // target

                        },
                        {    // goal
                            able:   3
                        }
                    );
                });

                it ("subtracts", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.subtract':true },
                            baker:  { '.type':'number', '.subtract':true }
                        },
                        {    // source
                            able:   3,
                            baker:  11
                        },
                        {    // target
                            able:   7,
                            baker:  9
                        },
                        {    // goal
                            able:   4,
                            baker:  -2
                        }
                    );
                });

                it ("subtracts from missing target", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.subtract':true }
                        },
                        {    // source
                            able:   3
                        },
                        {    // target

                        },
                        {    // goal
                            able:   -3
                        }
                    );
                });

                it ("multiplies", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.multiply':true },
                            baker:  { '.type':'number', '.multiply':true }
                        },
                        {    // source
                            able:   3,
                            baker:  11
                        },
                        {    // target
                            able:   7,
                            baker:  9
                        },
                        {    // goal
                            able:   21,
                            baker:  99
                        }
                    );
                });

                it ("multiplies with missing target", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.multiply':true }
                        },
                        {    // source
                            able:   3
                        },
                        {    // target

                        },
                        {    // goal
                            able:   0
                        }
                    );
                });

                it ("divides target by input", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.divide':true },
                            baker:  { '.type':'number', '.divide':true }
                        },
                        {    // source
                            able:   3,
                            baker:  11
                        },
                        {    // target
                            able:   7,
                            baker:  9
                        },
                        {    // goal
                            able:   7/3,
                            baker:  9/11
                        }
                    );
                });

                it ("divides missing target by input", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.divide':true }
                        },
                        {    // source
                            able:   3
                        },
                        {    // target

                        },
                        {    // goal
                            able:   0
                        }
                    );
                });

                it ("averages target with input", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.average':true },
                            baker:  { '.type':'number', '.average':true }
                        },
                        {    // source
                            able:   10,
                            baker:  100
                        },
                        {    // target
                            able:   0,
                            baker:  50
                        },
                        {    // goal
                            able:   5,
                            baker:  75
                        }
                    );
                });

                it ("averages missing target with input", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'number', '.average':true }
                        },
                        {    // source
                            able:   3
                        },
                        {    // target

                        },
                        {    // goal
                            able:   3
                        }
                    );
                });

            });

            it ("filters by modulo", function(){
                testTransform (
                    {    // schema
                        able:   { '.type':'number', '.modulate':4 },
                        baker:  { '.type':'number', '.modulate':7 }
                    },
                    {    // source
                        able:   10,
                        baker:  10
                    },
                    { }, // target
                    {    // goal
                        able:   2,
                        baker:  3
                    }
                );
            });

            it ("inverts", function(){
                testTransform (
                    {    // schema
                        able:   { '.type':'number', '.invert':true },
                        baker:  { '.type':'number', '.invert':true }
                    },
                    {    // source
                        able:   7,
                        baker:  -5
                    },
                    { }, // target
                    {    // goal
                        able:   -7,
                        baker:  5
                    }
                );
            });

            it ("reciprocates", function(){
                testTransform (
                    {    // schema
                        able:   { '.type':'number', '.reciprocal':true },
                        baker:  { '.type':'number', '.reciprocal':true }
                    },
                    {    // source
                        able:   10,
                        baker:  5
                    },
                    { }, // target
                    {    // goal
                        able:   1/10,
                        baker:  1/5
                    }
                );
            });

            describe ("post-transform (l|g)t(e)", function(){

                it ("selects when post-transform Numbers are within bounds", function(){
                    testTransform (
                        {    // schema
                            able:       { '.type':'number', '.max':100, '.add':true },
                            baker:      { '.type':'number', '.min':2, '.subtract':true },
                            charlie:    { '.type':'number', '.max':100, '.multiply':true },
                            dog:        { '.type':'number', '.min':0, '.divide':true },
                            easy:       { '.type':'number', '.max':7, '.modulate':7 },
                            fox:        { '.type':'number', '.max':0, '.inverse':true },
                            george:     { '.type':'number', '.max':1/5, '.reciprocal':true }
                        },
                        {    // source
                            able:       5,
                            baker:      6,
                            charlie:    7,
                            dog:        8,
                            easy:       9,
                            fox:        10,
                            george:     11
                        },
                        {    // target
                            able:       11,
                            baker:      10,
                            charlie:    9,
                            dog:        8,
                            easy:       7,
                            fox:        6,
                            george:     5
                        },
                        {    // goal
                            able:       16,
                            baker:      4,
                            charlie:    63,
                            dog:        1,
                            easy:       2,
                            fox:        -10,
                            george:     1/11
                        }
                    );
                });

                it ("rejects when post-transform Numbers are out of bounds", function(){
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.lte':10, '.add':true },
                            baker:      { '.type':'number', '.gte':2, '.subtract':true },
                            charlie:    { '.type':'number', '.lte':100, '.multiply':true },
                            dog:        { '.type':'number', '.gte':0, '.divide':true },
                            easy:       { '.type':'number', '.lte':7, '.modulate':7 },
                            fox:        { '.type':'number', '.lte':0, '.inverse':true },
                            george:     { '.type':'number', '.lte':1/5, '.reciprocal':true }
                        },
                        {    // source
                            able:       5,
                            baker:      6,
                            charlie:    7,
                            dog:        8,
                            easy:       9,
                            fox:        10,
                            george:     11
                        },
                        {    // target
                            able:       11,
                            baker:      10,
                            charlie:    9,
                            dog:        8,
                            easy:       7,
                            fox:        6,
                            george:     5
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.lte':100, '.add':true },
                            baker:      { '.type':'number', '.gte':10, '.subtract':true },
                            charlie:    { '.type':'number', '.lte':100, '.multiply':true },
                            dog:        { '.type':'number', '.gte':0, '.divide':true },
                            easy:       { '.type':'number', '.lte':7, '.modulate':7 },
                            fox:        { '.type':'number', '.lte':0, '.inverse':true },
                            george:     { '.type':'number', '.lte':1/5, '.reciprocal':true }
                        },
                        {    // source
                            able:       5,
                            baker:      6,
                            charlie:    7,
                            dog:        8,
                            easy:       9,
                            fox:        10,
                            george:     11
                        },
                        {    // target
                            able:       11,
                            baker:      10,
                            charlie:    9,
                            dog:        8,
                            easy:       7,
                            fox:        6,
                            george:     5
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.lte':100, '.add':true },
                            baker:      { '.type':'number', '.gte':3, '.subtract':true },
                            charlie:    { '.type':'number', '.lte':8, '.multiply':true },
                            dog:        { '.type':'number', '.gte':0, '.divide':true },
                            easy:       { '.type':'number', '.lte':7, '.modulate':7 },
                            fox:        { '.type':'number', '.lte':0, '.inverse':true },
                            george:     { '.type':'number', '.lte':1/5, '.reciprocal':true }
                        },
                        {    // source
                            able:       5,
                            baker:      6,
                            charlie:    7,
                            dog:        8,
                            easy:       9,
                            fox:        10,
                            george:     11
                        },
                        {    // target
                            able:       11,
                            baker:      10,
                            charlie:    9,
                            dog:        8,
                            easy:       7,
                            fox:        6,
                            george:     5
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.lte':100, '.add':true },
                            baker:      { '.type':'number', '.gte':3, '.subtract':true },
                            charlie:    { '.type':'number', '.lte':100, '.multiply':true },
                            dog:        { '.type':'number', '.gte':10, '.divide':true },
                            easy:       { '.type':'number', '.lte':7, '.modulate':7 },
                            fox:        { '.type':'number', '.lte':0, '.inverse':true },
                            george:     { '.type':'number', '.lte':1/5, '.reciprocal':true }
                        },
                        {    // source
                            able:       5,
                            baker:      6,
                            charlie:    7,
                            dog:        8,
                            easy:       9,
                            fox:        10,
                            george:     11
                        },
                        {    // target
                            able:       11,
                            baker:      10,
                            charlie:    9,
                            dog:        8,
                            easy:       7,
                            fox:        6,
                            george:     5
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.lte':100, '.add':true },
                            baker:      { '.type':'number', '.gte':3, '.subtract':true },
                            charlie:    { '.type':'number', '.lte':100, '.multiply':true },
                            dog:        { '.type':'number', '.gte':0, '.divide':true },
                            easy:       { '.type':'number', '.lte':6, '.modulo':7 },
                            fox:        { '.type':'number', '.lte':0, '.inverse':true },
                            george:     { '.type':'number', '.lte':1/5, '.reciprocal':true }
                        },
                        {    // source
                            able:       5,
                            baker:      6,
                            charlie:    7,
                            dog:        8,
                            easy:       9,
                            fox:        10,
                            george:     11
                        },
                        {    // target
                            able:       11,
                            baker:      10,
                            charlie:    9,
                            dog:        8,
                            easy:       7,
                            fox:        6,
                            george:     5
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.lte':100, '.add':true },
                            baker:      { '.type':'number', '.gte':3, '.subtract':true },
                            charlie:    { '.type':'number', '.lte':100, '.multiply':true },
                            dog:        { '.type':'number', '.gte':0, '.divide':true },
                            easy:       { '.type':'number', '.lte':7, '.modulate':7 },
                            fox:        { '.type':'number', '.gte':0, '.inverse':true },
                            george:     { '.type':'number', '.lte':1/5, '.reciprocal':true }
                        },
                        {    // source
                            able:       5,
                            baker:      6,
                            charlie:    7,
                            dog:        8,
                            easy:       9,
                            fox:        10,
                            george:     11
                        },
                        {    // target
                            able:       11,
                            baker:      10,
                            charlie:    9,
                            dog:        8,
                            easy:       7,
                            fox:        6,
                            george:     5
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.lte':100, '.add':true },
                            baker:      { '.type':'number', '.gte':3, '.subtract':true },
                            charlie:    { '.type':'number', '.lte':100, '.multiply':true },
                            dog:        { '.type':'number', '.gte':0, '.divide':true },
                            easy:       { '.type':'number', '.lte':7, '.modulate':7 },
                            fox:        { '.type':'number', '.lte':0, '.inverse':true },
                            george:     { '.type':'number', '.lte':0, '.reciprocal':true }
                        },
                        {    // source
                            able:       5,
                            baker:      6,
                            charlie:    7,
                            dog:        8,
                            easy:       9,
                            fox:        10,
                            george:     11
                        },
                        {    // target
                            able:       11,
                            baker:      10,
                            charlie:    9,
                            dog:        8,
                            easy:       7,
                            fox:        6,
                            george:     5
                        }
                    );
                });

            });

            it ("generates a total from an input Array", function(){
                testTransform (
                    { '.type':'number', '.total':true, '.add':true },
                    [ 1, 2, 3, 4, 5 ],
                    5,
                    20
                );
            });

            it ("generates a mean from an input Array", function(){
                testTransform (
                    { '.type':'number', '.mean':true, '.add':true },
                    [ 1, 2, 3, 4, 5 ],
                    5,
                    8
                );
            });

        });

        describe ("Strings", function(){

            describe (".inject", function(){

                it ("injects a String into the input", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.inject':[ [ 10, 'INTERRUPTING COW' ]] }
                        },
                        {    // source
                            able:   'This is my String. There are many like it but this one is mine.'
                        },
                        {    // target
                            able:   'this String is supposed to be overwritten'
                        },
                        {    // goal
                            able:   'This is myINTERRUPTING COW String. There are many like it '
                                  + 'but this one is mine.'
                        }
                    );
                });

                it ("appends a String onto the input", function(){
                    testTransform (
                        {    // schema
                            able:       { '.type':'string', '.inject':[ [ 'TRAILING COW' ] ] },
                            baker:      { '.type':'string', '.inject':[ [
                                undefined,
                                'TRAILING COW'
                            ] ] },
                            charlie:    { '.type':'string', '.inject':[ [
                                null,
                                'TRAILING COW'
                            ] ] },
                            dog:        { '.type':'string', '.inject':[ [
                                NaN,
                                'TRAILING COW'
                            ] ] }
                        },
                        {    // source
                            able:       'test',
                            baker:      'test',
                            charlie:    'test',
                            dog:        'test'
                        },
                        { }, // target
                        {    // goal
                            able:       'testTRAILING COW',
                            baker:      'testTRAILING COW',
                            charlie:    'testTRAILING COW',
                            dog:        'testTRAILING COW'
                        }
                    );
                });

            });

            describe (".insert", function(){

                it ("inserts the input into the target", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.insert':10 }
                        },
                        {    // source
                            able:   'INTERRUPTING COW'
                        },
                        {    // target
                            able:   'this String is supposed to be interrupted'
                        },
                        {    // goal
                            able:   'this StrinINTERRUPTING COWg is supposed to be interrupted'
                        }
                    );
                });

                it ("inserts the input into missing target", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.insert':10 }
                        },
                        {    // source
                            able:   'INTERRUPTING COW'
                        },
                        {    // target

                        },
                        {    // goal
                            able:   'INTERRUPTING COW'
                        }
                    );
                });

            });

            describe (".append", function(){

                it ("appends the input onto the target", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.append':true }
                        },
                        {    // source
                            able:   'FOLLOWING COW'
                        },
                        {    // target
                            able:   'this String is supposed to have a cow.'
                        },
                        {    // goal
                            able:   'this String is supposed to have a cow.FOLLOWING COW'
                        }
                    );
                });

                it ("appends the input onto missing target", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.append':true }
                        },
                        {    // source
                            able:   'FOLLOWING COW'
                        },
                        {    // target

                        },
                        {    // goal
                            able:   'FOLLOWING COW'
                        }
                    );
                });

            });

            describe (".prepend", function(){

                it ("prepends the input onto the target", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.prepend':true }
                        },
                        {    // source
                            able:   'LEADING COW'
                        },
                        {    // target
                            able:   'this String is supposed to have a cow.'
                        },
                        {    // goal
                            able:   'LEADING COWthis String is supposed to have a cow.'
                        }
                    );
                });

                it ("prepends the input onto missing target", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.append':true }
                        },
                        {    // source
                            able:   'LEADING COW'
                        },
                        {    // target

                        },
                        {    // goal
                            able:   'LEADING COW'
                        }
                    );
                });

            });

            describe (".case", function(){

                it ("uppercase converts the input", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.case':'upper' }
                        },
                        {    // source
                            able:   'small cow'
                        },
                        {    // target
                            able:   'This String is supposed to be overwritten.'
                        },
                        {    // goal
                            able:   'SMALL COW'
                        }
                    );
                });

                it ("lowercase converts the input", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'string', '.case':'lower' }
                        },
                        {    // source
                            able:   'LARGE COW'
                        },
                        {    // target
                            able:   'This String is supposed to be overwritten.'
                        },
                        {    // goal
                            able:   'large cow'
                        }
                    );
                });

            });

            describe ("post-transform .max", function(){

                it ("proceeds when post-transform String is within bounds", function(){
                    testTransform (
                        {    // schema
                            able:   {
                                '.type':        'string',
                                '.inject':      [ [ 1, 'foo' ]],
                                '.prepend':     true,
                                '.maxLength':   20
                            }
                        },
                        {    // source
                            able:   'cheese'
                        },
                        {    // target
                            able:   ' factory'
                        },
                        {    // goal
                            able:   'cfooheese factory'
                        }
                    );
                });

                it ("fails when post-transform String is out of bounds", function(){
                    testTransformFailure (
                        {    // schema
                            able:   {
                                '.type':        'string',
                                '.inject':      [ [ 1, 'foo' ]],
                                '.prepend':     true,
                                '.maxLength':   15
                            }
                        },
                        {    // source
                            able:   'cheese'
                        },
                        {    // target
                            able:   ' factory'
                        }
                    );
                });

            });

            describe ("post-transform .regex match", function(){

                it ("proceeds when post-transform String matches a regex filter", function(){
                    testTransform (
                        {    // schema
                            able:   {
                                '.type':        'string',
                                '.inject':      [ [ 1, 'foo' ]],
                                '.prepend':     true,
                                '.regex':       /^[a-zA-Z ]+$/
                            }
                        },
                        {    // source
                            able:   'cheese'
                        },
                        {    // target
                            able:   ' factory'
                        },
                        {    // goal
                            able:   'cfooheese factory'
                        }
                    );
                });

                it ("fails when post-transform String does not match a regex filter", function(){
                    testTransformFailure (
                        {    // schema
                            able:   {
                                '.type':        'string',
                                '.inject':      [ [ 1, 'f00' ]],
                                '.prepend':     true,
                                '.regex':       /^[a-zA-Z ]+$/
                            }
                        },
                        {    // source
                            able:   'cheese'
                        },
                        {    // target
                            able:   ' factory'
                        }
                    );
                });

            });

        });

        describe ("Booleans", function(){

            describe (".cast", function(){

                it ("casts Strings to Booleans", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'boolean', '.cast':true }
                        },
                        {    // source
                            able:   'true'
                        },
                        { }, // target
                        {    // goal
                            able:   true
                        }
                    );
                    testTransform (
                        {    // schema
                            able:   { '.type':'boolean', '.cast':true }
                        },
                        {    // source
                            able:   'false'
                        },
                        { }, // target
                        {    // goal
                            able:   false
                        }
                    );
                });

                it ("rejects invalid Boolean Strings", function(){
                    testTransformFailure (
                        {    // schema
                            able:   { '.type':'boolean', '.cast':true }
                        },
                        {    // source
                            able:   'truth'
                        },
                        { }
                    );
                });

            });

            describe (".inverse", function(){

                it ("inverts booleans", function(){
                    testTransform (
                        { able:{ '.type':'boolean', '.inverse':true }},
                        { able:true },
                        {},
                        { able:false }
                    );
                });

            });
        });

        describe ("Objects", function(){

            describe (".cast", function(){

                it ("casts JSON Strings to Objects", function(){
                    testTransform (
                        {    // schema
                            able:   {
                                '.type':    'object',
                                '.cast':    true ,
                                able:       { '.type':'string' },
                                baker:      {
                                    able:       { '.type':'number' }
                                }
                            }
                        },
                        {    // source
                            able:   '{ "able":"foo", "baker":{ "able":9001 }}'
                        },
                        { }, // target
                        {    // goal
                            able:   { "able":"foo", "baker":{ "able":9001 }}
                        }
                    );
                });

                it ("rejects invalid JSON", function(){
                    testTransformFailure (
                        {    // schema
                            able:   { '.type':'object', '.cast':true }
                        },
                        {    // source
                            able:   '{ "able":"foo", "baker":{ able:9001 }}'
                        },
                        { }
                    );
                    testTransformFailure (
                        {    // schema
                            able:   { '.type':'object', '.cast':true }
                        },
                        {    // source
                            able:   '[ 0, 1, 2, { able:"foo" } ]'
                        },
                        { }
                    );
                });

            });

            describe (".inject", function(){

                it ("injects keys into the input", function(){
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.inject':      [
                                [ 'able', 9001 ],
                                [ 'baker', { able: 9001 } ]
                            ]
                        },
                        {    // source
                            able:           'nine thousand and one',
                            charlie:        'one thousand and nine'
                        },
                        { }, // target
                        {    // goal
                            able:           9001,
                            baker:          { able:9001 },
                            charlie:        'one thousand and nine'
                        }
                    );
                });

            });

            describe (".rename", function(){

                it ("renames keys", function(){
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.rename':      {
                                able:           'baker'
                            }
                        },
                        {    // source
                            able:   9001
                        },
                        { }, // target
                        {    // goal
                            baker:  9001
                        }
                    );
                });

                it ("clobbers keys in the source", function(){
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.rename':      {
                                able:           'baker'
                            }
                        },
                        {    // source
                            baker:  'nine thousand and one',
                            able:   9001
                        },
                        { }, // target
                        {    // goal
                            baker:  9001
                        }
                    );
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.rename':      {
                                able:           'baker'
                            }
                        },
                        {    // source
                            able:   9001,
                            baker:  'nine thousand and one'
                        },
                        { }, // target
                        {    // goal
                            baker:  'nine thousand and one'
                        }
                    );
                });

                it ("processes keys with their new names", function(){
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.rename':      {
                                able:           'baker'
                            },
                            able:           { '.type':'string', '.optional':true },
                            baker:          { '.type':'number' }
                        },
                        {    // source
                            able:   9001
                        },
                        { }, // target
                        {    // goal
                            baker:  9001
                        }
                    );
                });

            });

            describe (".drop", function(){

                it ("drops keys from the input", function(){
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.drop':        [ 'baker' ]
                        },
                        {    // source
                            able:   9001,
                            baker:  'nine thousand and one'
                        },
                        { }, // target
                        {    // goal
                            able:   9001
                        }
                    );
                });

            });

            describe (".clip", function(){

                it ("keeps only the newest keys from the target document", function(){
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.clip':        3
                        },
                        {    // source
                            charlie:    42,
                            dog:        'forty two'
                        },
                        {    // target
                            able:       9001,
                            baker:      'nine thousand and one'
                        },
                        {    // goal
                            baker:      'nine thousand and one',
                            charlie:    42,
                            dog:        'forty two'
                        }
                    );
                });

                it ("keeps only the oldest keys from the target document", function(){
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.clip':        -3
                        },
                        {    // source
                            charlie:    42,
                            dog:        'forty two'
                        },
                        {    // target
                            able:       9001,
                            baker:      'nine thousand and one'
                        },
                        {    // goal
                            able:       9001,
                            baker:      'nine thousand and one',
                            charlie:    42
                        }
                    );
                });

            });

            describe ("post-transform .max", function(){

                it ("fails when a post-injection source violates a .max constraint", function(){
                    testTransformFailure (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.maxKeys':     4,
                            '.inject':      [
                                [ 'easy', 42 ],
                                [ 'fox', 7 ]
                            ]
                        },
                        {    // source
                            dog:        'forty two'
                        },
                        {    // target
                            able:       9001,
                            baker:      'nine thousand and one',
                            charlie:    42
                        }
                    );
                });

            });

        });

        describe ("Arrays", function(){

            describe (".cast", function(){

                it ("casts JSON Strings to Arrays", function(){
                    testTransform (
                        {    // schema
                            able:   { '.type':'array', '.cast':true }
                        },
                        {    // source
                            able:   '[ 0, 1, 2, { "able":"foo" } ]'
                        },
                        { }, // target
                        {    // goal
                            able:   [ 0, 1, 2, { able:"foo" } ]
                        }
                    );
                });

                it ("rejects invalid JSON", function(){
                    testTransformFailure (
                        {    // schema
                            able:   { '.type':'array', '.cast':true }
                        },
                        {    // source
                            able:   '[ 0, 1, 2, { able:"foo" } ]'
                        },
                        { }
                    );
                    testTransformFailure (
                        {    // schema
                            able:   { '.type':'array', '.cast':true }
                        },
                        {    // source
                            able:   '{ "able":"foo", "baker":{ "able:9001" }}'
                        },
                        { }
                    );
                });

            });

            describe (".sort", function(){

                it ("appends to the correct position when using a simple .sort", function(){
                    testTransform (
                        { '.sort':1, '.append':true },
                        [ 4, 7, 8, 20, 2 ],
                        [ 9, 11, 6 ],
                        [ 2, 4, 6, 7, 8, 9, 11, 20 ]
                    );
                });

                it ("prepends to the correct position when using a simple .sort", function(){
                    testTransform (
                        { '.sort':1, '.prepend':true },
                        [ 4, 7, 8, 20, 2 ],
                        [ 9, 11, 6 ],
                        [ 2, 4, 6, 7, 8, 9, 11, 20 ]
                    );
                });

                it ("inserts to the correct position when using a simple .sort", function(){
                    testTransform (
                        { '.sort':1, '.insert':3 },
                        [ 4, 7, 8, 20, 2 ],
                        [ 9, 11, 6 ],
                        [ 2, 4, 6, 7, 8, 9, 11, 20 ]
                    );
                });

                it ("appends to the correct position when using a complex .sort", function(){
                    testTransform (
                        { '.sort':{ able:1 }, '.append':true },
                        [ { able:4 }, { able:7 }, { able:8 }, { able:20 }, { able:2 } ],
                        [ { able:9 }, { able:11 }, { able:6 } ],
                        [
                            { able:2 }, { able:4 }, { able:6  }, { able:7  },
                            { able:8 }, { able:9 }, { able:11 }, { able:20 }
                        ]
                    );
                });

                it ("prepends to the correct position when using a complex .sort", function(){
                    testTransform (
                        { '.sort':{ able:1 }, '.prepend':true },
                        [ { able:4 }, { able:7 }, { able:8 }, { able:20 }, { able:2 } ],
                        [ { able:9 }, { able:11 }, { able:6 } ],
                        [
                            { able:2 }, { able:4 }, { able:6  }, { able:7  },
                            { able:8 }, { able:9 }, { able:11 }, { able:20 }
                        ]
                    );
                });

                it ("inserts to the correct position when using a complex .sort", function(){
                    testTransform (
                        { '.sort':{ able:1 }, '.insert':3 },
                        [ { able:4 }, { able:7 }, { able:8 }, { able:20 }, { able:2 } ],
                        [ { able:9 }, { able:11 }, { able:6 } ],
                        [
                            { able:2 }, { able:4 }, { able:6  }, { able:7  },
                            { able:8 }, { able:9 }, { able:11 }, { able:20 }
                        ]
                    );
                });

                it ("pre-sorts the input value when using simple .sort and .sequence", function(){
                    testTransform (
                        { '.sort':1, '.sequence':[ { '.add':true }, { '.multiply':true } ] },
                        [ 20, 10 ],
                        [ 10, 20 ],
                        [ 20, 400 ]
                    );
                });

                it ("pre-sorts the input value when using complex .sort and .sequence", function(){
                    testTransform (
                        { '.sort':1, '.sequence':[
                            { able:{ '.add':true } },
                            { able:{ '.multiply':true } }
                        ] },
                        [ { able:20 }, { able:10 } ],
                        [ { able:10 }, { able:20 } ],
                        [ { able:20 }, { able:400 } ]
                    );
                });

            });

            describe (".inject", function(){

                it ("adds values to the input", function(){
                    testTransform (
                        {    // schema
                            able:       {
                                '.type':    'array',
                                '.inject':  [
                                    [ 9001 ],
                                    [ undefined, 9001 ],
                                    [ null, 9001 ],
                                    [ NaN, 9001 ]
                                ]
                            }
                        },
                        {    // source
                            able:       [ 0, 1, 2, 3, 4 ]
                        },
                        { }, // target
                        {    // goal
                            able:       [ 0, 1, 2, 3, 4, 9001, 9001, 9001, 9001 ]
                        }
                    );
                });

                it ("splices values into the input", function(){
                    testTransform (
                        {    // schema
                            able:       {
                                '.type':    'array',
                                '.inject':  [
                                    [ 5, 9001 ],
                                    [ 3, 9001 ],
                                    [ 1, 9001 ]
                                ]
                            }
                        },
                        {    // source
                            able:       [ 0, 1, 2, 3, 4, 5, 6 ]
                        },
                        { }, // target
                        {    // goal
                            able:       [ 0, 9001, 1, 2, 9001, 3, 4, 9001, 5, 6 ]
                        }
                    );
                });

                it ("splices values in order", function(){
                    testTransform (
                        {    // schema
                            able:       {
                                '.type':    'array',
                                '.inject':  [
                                    [ 1, 9001 ],
                                    [ 3, 9001 ],
                                    [ 5, 9001 ]
                                ]
                            }
                        },
                        {    // source
                            able:       [ 0, 1, 2, 3, 4, 5, 6 ]
                        },
                        { }, // target
                        {    // goal
                            able:       [ 0, 9001, 1, 9001, 2, 9001, 3, 4, 5, 6 ]
                        }
                    );
                });

            });

            describe (".insert", function(){

                it ("inserts input values into the target", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.insert':  3
                        },
                        [    // source
                            9, 9, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // goal
                            0, 1, 2, 9, 9, 9, 3, 4, 5, 6, 7, 8, 9
                        ]
                    );
                });

                it ("inserts input values into empty target", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.insert':  3
                        },
                        [    // source
                            9, 9, 9
                        ],
                        [    // target

                        ],
                        [    // goal
                            9, 9, 9
                        ]
                    );
                });

                it ("inserts input values into missing target", function(){
                    testTransform (
                        {    // schema
                            able:       {
                                '.type':    'array',
                                '.insert':  3
                            }
                        },
                        {    // source
                            able:       [ 9, 9, 9 ]
                        },
                        { }, // target
                        {    // goal
                            able:       [ 9, 9, 9 ]
                        }
                    );
                });

                it ("injects before insertion", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.insert':  3,
                            '.inject':  [
                                [ 1, 10 ],
                                [ 10 ]
                            ]
                        },
                        [    // source
                            9, 9, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // goal
                            0, 1, 2, 9, 10, 9, 9, 10, 3, 4, 5, 6, 7, 8, 9
                        ]
                    );
                });

                it ("inserts only novel values with .unique", function(){
                    testTransform (
                        { '.insert':3, '.unique':true },
                        [ 1, 2, 3, 4, 5, 6 ],
                        [ 1, 3, 5, 7 ],
                        [ 1, 3, 5, 2, 4, 6, 7 ]
                    );
                });

            });

            describe (".append", function(){

                it ("appends input values to the target", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.append':  true
                        },
                        [    // source
                            9, 9, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // goal
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 9
                        ]
                    );
                });

                it ("injects before appending", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.append':  true,
                            '.inject':  [
                                [ 1, 10 ],
                                [ 10 ]
                            ]
                        },
                        [    // source
                            9, 9, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // goal
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 10, 9, 9, 10
                        ]
                    );
                });

                it ("appends only novel values with .unique", function(){
                    testTransform (
                        { '.append':true, '.unique':true },
                        [ 1, 2, 3, 4, 5, 6 ],
                        [ 1, 3, 5, 7 ],
                        [ 1, 3, 5, 7, 2, 4, 6 ]
                    );
                });

            });

            describe (".prepend", function(){

                it ("prepends input values to the target", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.prepend': true
                        },
                        [    // source
                            9, 9, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // goal
                            9, 9, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ]
                    );
                });

                it ("injects before prepending", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.prepend': true,
                            '.inject':  [
                                [ 1, 10 ],
                                [ 10 ]
                            ]
                        },
                        [    // source
                            9, 9, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // goal
                            9, 10, 9, 9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ]
                    );
                });

                it ("prepends only novel values with .unique", function(){
                    testTransform (
                        { '.prepend':true, '.unique':true },
                        [ 1, 2, 3, 4, 5, 6 ],
                        [ 1, 3, 5, 7 ],
                        [ 2, 4, 6, 1, 3, 5, 7 ]
                    );
                });

            });

            describe (".clip", function(){

                it ("keeps only the last elements of the target", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.clip':    -4
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [ ], // target
                        [    // goal
                            6, 7, 8, 9
                        ]
                    );
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.clip':    -4,
                            '.prepend':  true
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // target
                            7
                        ],
                        [    // goal
                            7, 8, 9, 7
                        ]
                    );
                });

                it ("keeps only the first elements of the target", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.clip':    4
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [ ], // target
                        [    // goal
                            0, 1, 2, 3
                        ]
                    );
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.clip':    4,
                            '.append': true
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // target
                            7
                        ],
                        [    // goal
                            7, 0, 1, 2
                        ]
                    );
                });

            });

            describe ("post-transform .max", function(){

                it ("rejects element counts not within bounds after transform", function(){
                    testTransformFailure (
                        {    // schema
                            '.type':    'array',
                            '.append':  true,
                            '.maxVals': 15
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ]
                    );
                    testTransformFailure (
                        {    // schema
                            '.type':    'array',
                            '.prepend': true,
                            '.maxVals': 15
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ]
                    );
                    testTransformFailure (
                        {    // schema
                            '.type':    'array',
                            '.insert':  5,
                            '.maxVals': 15
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ]
                    );
                    testTransformFailure (
                        {    // schema
                            '.type':    'array',
                            '.inject':  [
                                [ 1, 9 ],
                                [ 3, 9 ],
                                [ 5, 9 ]
                            ],
                            '.maxVals': 11
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [ ]
                    );
                });

            });

        });

    });

    describe ("polyschemata", function(){

        it ("always fails to transform with mismatched source and target types", function(){
            testTransformFailure (
                { ".or":[
                    { '.type':'string', '.match':/^\w+$/, '.append':true },
                    { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                ] },
                [ 'foo' ],
                'bar'
            );
            testTransformFailure (
                { ".xor":[
                    { '.type':'string', '.match':/^\w+$/, '.append':true },
                    { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                ] },
                [ 'foo' ],
                'bar'
            );
        });

        describe ("anyOf", function(){

            it ("transforms with one of several schemata", function(){
                testTransform (
                    { ".or":[
                        { '.type':'string', '.match':/^\w+$/, '.append':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true },
                        { '.type':'string', '.match':/^\w+$/, '.prepend':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                    ] },
                    [ 'foo', 'bar' ],
                    [ 'baz' ],
                    [ 'foo', 'bar', 'baz' ]
                );
                testTransform (
                    { ".or":[
                        { '.type':'string', '.match':/^\w+$/, '.append':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true },
                        { '.type':'string', '.match':/^\w+$/, '.prepend':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                    ] },
                    'baz',
                    'foobar',
                    'foobarbaz'
                );
            });

            it ("fails to match any of several schemata", function(){
                testTransformFailure (
                    { ".or":[
                        { '.type':'string', '.match':/^\w+$/, '.append':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true },
                        { '.type':'string', '.match':/^\w+$/, '.prepend':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                    ] },
                    'foo bar',
                    'baz'
                );
            });

        });

        describe ("oneOf", function(){

            it ("transforms with one of several schemata", function(){
                testTransform (
                    { ".xor":[
                        { '.type':'string', '.match':/^\w+$/, '.append':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                    ] },
                    [ 'foo', 'bar' ],
                    [ 'baz' ],
                    [ 'foo', 'bar', 'baz' ]
                );
                testTransform (
                    { ".xor":[
                        { '.type':'string', '.match':/^\w+$/, '.append':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                    ] },
                    'baz',
                    'foobar',
                    'foobarbaz'
                );
            });

            it ("fails to transform with any of several schemata", function(){
                testTransformFailure (
                    { ".xor":[
                        { '.type':'string', '.match':/^\w+$/, '.append':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                    ] },
                    'foo bar',
                    'baz'
                );
            });

            it ("fails to transform due to too many passing schema", function(){
                testTransformFailure (
                    { ".xor":[
                        { '.type':'string', '.match':/^\w+$/, '.append':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true },
                        { '.type':'array', '.all':{ '.type':'string', '.match':/^\w+$/ }, '.prepend':true }
                    ] },
                    [ 'foo', 'bar' ],
                    [ 'baz' ]
                );
            });

        });

        describe ("not", function(){

            it ("transform when the inverse schema fails to validate after transform", function(){
                testTransform (
                    { ".type":"string", ".not":{ ".match":/^\w+$/ }, ".append":true },
                    "foo bar",
                    "baz",
                    "bazfoo bar"
                );
                testTransform (
                    { ".type":"string", ".not":{ ".match":/^\w+$/ }, ".append":true },
                    "baz",
                    "foo bar",
                    "foo barbaz"
                );
            });

            it ("fails to transform when the inverse schema validates after transform", function(){
                testTransformFailure (
                    { ".type":"string", ".not":{ ".match":/^\w+$/ }, ".append":true, ".clip":6 },
                    "foo bar",
                    "baz"
                );
            });

        });

    });

    describe ("accumulators", function(){

        it ("processes a complex .fill", function(){

            testTransform (
                {
                    expenses:   {
                        '.type':        'array',
                        '.all':         {
                            amount:         { '.type':'number', '.gt':0 },
                            type:           { '.type':'string', '.lt':128 },
                            description:    { '.type':'string', '.optional':true },
                            time:           { '.type':'string', '.format':'date-time' }
                        },
                        '.append':      true
                    },
                    income:         {
                        paycheques:     {
                            '.type':        'array',
                            '.all':         {
                                amount:         { '.type':'number', '.gt':0 },
                                description:    { '.type':'string', '.optional':true },
                                time:           { '.type':'string', '.format':'date-time' }
                            },
                            '.append':      true
                        },
                        other:          {
                            '.type':        'array',
                            '.all':         {
                                amount:         { '.type':'number', '.gt':0 },
                                type:           { '.type':'string', '.lt':128 },
                                description:    { '.type':'string', '.optional':true },
                                time:           { '.type':'string', '.format':'date-time' }
                            },
                            '.append':      true
                        },
                    },
                    monthly:        {
                        '.default':     {},
                        income:         {
                            '.fill':        {
                                '.fill':        [
                                    'income/paycheques/amount',
                                    'income/other/amount'
                                ],
                                '.type':        'number',
                                '.add':         true
                            },
                            '.average':     5
                        },
                        expenses:       {
                            '.fill':        {
                                '.fill':        'expenses/amount',
                                '.type':        'number',
                                '.add':         true
                            },
                            '.average':     5
                        }
                    }
                },
                {
                    expenses:   [
                        {
                            amount:         172.03,
                            type:           'grocery',
                            time:           '2014-6-3'
                        },
                        {
                            amount:         158.88,
                            type:           'grocery',
                            time:           '2014-6-10'
                        },
                        {
                            amount:         2500.00,
                            type:           'rent',
                            time:           '2014-6-15'
                        },
                        {
                            amount:         204.16,
                            type:           'grocery',
                            time:           '2014-6-17'
                        },
                        {
                            amount:         160.33,
                            type:           'grocery',
                            time:           '2014-6-24'
                        },
                        {
                            amount:         39.99,
                            type:           'entertainment',
                            description:    'Deathkiller 7 Pre-Order',
                            time:           '2014-6-19'
                        }
                    ],
                    income:         {
                        paycheques:     [
                            {
                                amount:         3051.48,
                                time:           '2014-6-1'
                            }
                        ],
                        other:          [
                            {
                                amount:         50.00,
                                type:           'gambling',
                                time:           '2014-6-17'
                            }
                        ]
                    }
                },
                {
                    expenses:   [
                        {
                            amount:         2500.00,
                            type:           'rent',
                            time:           '2014-5-15'
                        },
                        {
                            amount:         24.99,
                            type:           'grocery',
                            description:    'beer',
                            time:           '2014-5-15'
                        }
                    ],
                    income:         {
                        paycheques:     [
                            {
                                amount:         3145.72,
                                time:           '2014-3-1'
                            },
                            {
                                amount:         3009.17,
                                time:           '2014-4-1'
                            },
                            {
                                amount:         3050.89,
                                time:           '2014-5-1'
                            }
                        ],
                        other:          [
                            {
                                amount:         1500.00,
                                type:           'contract',
                                time:           '1995-1-25'
                            }
                        ]
                    },
                    monthly:    {
                        income:     3068.59,
                        expenses:   2524.99
                    }
                },
                {
                    expenses:   [
                        {
                            amount:         2500.00,
                            type:           'rent',
                            time:           '2014-5-15'
                        },
                        {
                            amount:         24.99,
                            type:           'grocery',
                            description:    'beer',
                            time:           '2014-5-15'
                        },
                        {
                            amount:         172.03,
                            type:           'grocery',
                            time:           '2014-6-3'
                        },
                        {
                            amount:         158.88,
                            type:           'grocery',
                            time:           '2014-6-10'
                        },
                        {
                            amount:         2500.00,
                            type:           'rent',
                            time:           '2014-6-15'
                        },
                        {
                            amount:         204.16,
                            type:           'grocery',
                            time:           '2014-6-17'
                        },
                        {
                            amount:         160.33,
                            type:           'grocery',
                            time:           '2014-6-24'
                        },
                        {
                            amount:         39.99,
                            type:           'entertainment',
                            description:    'Deathkiller 7 Pre-Order',
                            time:           '2014-6-19'
                        }
                    ],
                    income:         {
                        paycheques:     [
                            {
                                amount:         3145.72,
                                time:           '2014-3-1'
                            },
                            {
                                amount:         3009.17,
                                time:           '2014-4-1'
                            },
                            {
                                amount:         3050.89,
                                time:           '2014-5-1'
                            },
                            {
                                amount:         3051.48,
                                time:           '2014-6-1'
                            }
                        ],
                        other:          [
                            {
                                amount:         1500.00,
                                type:           'contract',
                                time:           '1995-1-25'
                            },
                            {
                                amount:         50.00,
                                type:           'gambling',
                                time:           '2014-6-17'
                            }
                        ]
                    },
                    monthly:    {
                        income:     3075.168,
                        expenses:   2667.0699999999997
                    }
                }
            );
        });

        it ("processes a complex .list", function(){

            testTransform (
                { // schema
                    dataPoints: {
                        '.type':    'array',
                        '.all':     {
                            x:          { '.type':'number', '.gte':0 },
                            y:          { '.type':'number', '.gte':0 }
                        },
                        '.sort':    { x:1 },
                        '.append':  true
                    },
                    average:        {
                        '.default':     {},
                        x:        {
                            '.type':        'number',
                            '.list':        'dataPoints/x',
                            '.transform':   function (target, points) {
                                if (!points.length) return 0;
                                var total = 0;
                                for (var i=0,j=points.length; i<j; total+=points[i], i++);
                                return total / points.length;
                            }
                        },
                        y:              {
                            '.type':        'number',
                            '.list':        'dataPoints/y',
                            '.transform':   function (target, points) {
                                if (!points.length) return 0;
                                var total = 0;
                                for (var i=0,j=points.length; i<j; total+=points[i], i++);
                                return total / points.length;
                            }
                        }
                    },
                },
                { // source
                    dataPoints: [
                        { x:0, y:10 },
                        { x:5, y:20 },
                        { x:15, y:40 },
                        { x:10, y:30 },
                        { x:20, y:50 },
                        { x:35, y:80 },
                        { x:25, y:60 },
                        { x:30, y:70 }
                    ]
                },
                { }, // target
                { // goal
                    dataPoints: [
                        { x:0, y:10 },
                        { x:5, y:20 },
                        { x:10, y:30 },
                        { x:15, y:40 },
                        { x:20, y:50 },
                        { x:25, y:60 },
                        { x:30, y:70 },
                        { x:35, y:80 }
                    ],
                    average:    {
                        x:          17.5,
                        y:          45
                    }
                }
            );

        });

        it ("creates filled Objects", function(){

            testTransform (
                {
                    '.default': {},
                    vals:       { '.type':'array', '.append':true, '.all':{
                        able:       { '.type':'number' },
                        baker:      { '.type':'number' }
                    } },
                    generated:  {
                        yoke:           { '.type':'array', '.all':{ '.type':'number' }, '.append':true },
                        zebra:          { '.type':'array', '.all':{ '.type':'number' }, '.append':true },
                        '.fill':        'vals',
                        '.transform':   function (target, values) {
                            return {
                                yoke:   values.map (function (a) { return a.able }),
                                zebra:  values.map (function (a) { return a.baker })
                            }
                        }
                    }
                },
                {
                    vals:   [
                        { able:0, baker:9 },
                        { able:1, baker:8 },
                        { able:2, baker:7 },
                        { able:3, baker:6 },
                        { able:4, baker:5 }
                    ]
                },
                undefined,
                {
                    vals:   [
                        { able:0, baker:9 },
                        { able:1, baker:8 },
                        { able:2, baker:7 },
                        { able:3, baker:6 },
                        { able:4, baker:5 }
                    ],
                    generated: {
                        yoke: [ 0, 1, 2, 3, 4 ],
                        zebra:[ 9, 8, 7, 6, 5 ]
                    }
                }
            );

        });

        it ("processes groups of values with .group and .groupTransform", function(){
            testTransform (
                {
                    able:       {
                        '.type':    'array',
                        '.all':     {
                            able:       { '.type':'number' },
                            baker:      { '.type':'number' }
                        },
                        '.append':  true
                    },
                    baker:      {
                        '.type':        'number',
                        '.transform':   function (target, value) {
                            var total = 0;
                            for (var i=0,j=value.length; i<j; i++)
                                total += value[i];
                            return total / value.length;
                        },
                        '.fill':        {
                            '.fill':        'able',
                            '.group':       {
                                '.fill':        'able',
                                '.getMonth':    true
                            },
                            '.groupTransform':{
                                '.fill':        'baker',
                                '.add':         true
                            }
                        }
                    }
                },
                {
                    able:       [
                        { able:new Date (2015, 1, 7).getTime(), baker:10 },
                        { able:new Date (2015, 1, 8).getTime(), baker:20 },
                        { able:new Date (2015, 1, 9).getTime(), baker:30 },
                        { able:new Date (2015, 2, 7).getTime(), baker:11 },
                        { able:new Date (2015, 2, 8).getTime(), baker:21 },
                        { able:new Date (2015, 2, 9).getTime(), baker:31 },
                        { able:new Date (2015, 3, 7).getTime(), baker:12 },
                        { able:new Date (2015, 3, 8).getTime(), baker:22 },
                        { able:new Date (2015, 3, 9).getTime(), baker:32 },
                        { able:new Date (2015, 4, 7).getTime(), baker:13 },
                        { able:new Date (2015, 4, 8).getTime(), baker:23 },
                        { able:new Date (2015, 4, 9).getTime(), baker:33 },
                        { able:new Date (2015, 5, 7).getTime(), baker:14 },
                        { able:new Date (2015, 5, 8).getTime(), baker:24 },
                        { able:new Date (2015, 5, 9).getTime(), baker:34 }
                    ]
                },
                undefined,
                {
                    able:       [
                        { able:new Date (2015, 1, 7).getTime(), baker:10 },
                        { able:new Date (2015, 1, 8).getTime(), baker:20 },
                        { able:new Date (2015, 1, 9).getTime(), baker:30 },
                        { able:new Date (2015, 2, 7).getTime(), baker:11 },
                        { able:new Date (2015, 2, 8).getTime(), baker:21 },
                        { able:new Date (2015, 2, 9).getTime(), baker:31 },
                        { able:new Date (2015, 3, 7).getTime(), baker:12 },
                        { able:new Date (2015, 3, 8).getTime(), baker:22 },
                        { able:new Date (2015, 3, 9).getTime(), baker:32 },
                        { able:new Date (2015, 4, 7).getTime(), baker:13 },
                        { able:new Date (2015, 4, 8).getTime(), baker:23 },
                        { able:new Date (2015, 4, 9).getTime(), baker:33 },
                        { able:new Date (2015, 5, 7).getTime(), baker:14 },
                        { able:new Date (2015, 5, 8).getTime(), baker:24 },
                        { able:new Date (2015, 5, 9).getTime(), baker:34 }
                    ],
                    baker:      66
                }
            );
        });

        it ("constrains with .filter", function(){
            testTransform (
                {
                    '.tolerant':    true,
                    foo:            {
                        '.list':        'able/able/able',
                        '.filter':      { '.gt':10 }
                    },
                    bar:            {
                        '.fill':        'able/able',
                        '.append':      true,
                        '.filter':      { able:{ '.gt':10 } }
                    }
                },
                {
                    able:   [
                        {
                            able:   [
                                { able:1 },
                                { able:11 }
                            ]
                        },
                        {
                            able:   [
                                { able:2 },
                                { able:12 }
                            ]
                        }
                    ]
                },
                undefined,
                {
                    foo:    [ 11, 12 ],
                    bar:    [ { able:11 }, { able:12 } ]
                }
            );
        });

    });

});
