
var Likeness = require ('../../Likeness');
var TransformError = Likeness.errors.TransformError;
var assert = require ('assert');

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
    try {
        schema.transform (source, target);
    } catch (err) {
        if (err instanceof TransformError)
            throw new Error ('failed with err '+JSON.stringify (err));
        throw err;
    }
    if (!deepCompare (target, goal))
        throw new Error ('goal did not match - '+JSON.stringify (target));
    if (sourceStr != JSON.stringify (source))
        throw new Error ('transform damaged the source object');
}

function testTransformFailure (schema, source, target, error) {
    schema = new Likeness (schema);
    var sourceStr = JSON.stringify (source);
    try {
        schema.transform (source, target);
    } catch (err) {
        if (error) {
            for (var key in error)
                if (!Object.hasOwnProperty.call (err, key) || err[key] !== error[key]) {
                    throw new Error (
                        'thrown error property "'
                      + key
                      + '": '
                      + err[key]
                      + ' != '
                      + error[key]
                    );
                }
        }

        if (sourceStr != JSON.stringify (source))
            throw new Error ('transform damaged the source object');

        return;
    }
    throw new Error ('transform completed erroneously');
}

describe ("#transform", function(){

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
                    able:       'zero',
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

        it ('applies .all transforms to every child', function(){
            testTransform (
                { // schema
                    '.arbitrary':   true,
                    '.all':         {
                        '.arbitrary':   true,
                        '.inject':      [
                            [ 1, 'asdf' ]
                        ]
                    }
                },
                { // source
                    able:       'this and that',
                    baker:      [ 'fdsa', 'jkl;', 'trew', 'zxcv' ],
                    charlie:    { zero:'one' }
                },
                { // target

                },
                { // goal
                    able:       'tasdfhis and that',
                    baker:      [ 'fdsa', 'asdf', 'jkl;', 'trew', 'zxcv' ],
                    charlie:    { zero:'one', 1:'asdf' }
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

                },
                { // error
                    code:       'ILLEGAL'
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

    describe ("simple constraints", function(){

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
                    { }, // target
                    {    // error
                        code:   'TYPE'
                    }
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
                    { }, // target
                    {    // error
                        code:   'TYPE'
                    }
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
                    { }, // target
                    {    // error
                        code:   'TYPE'
                    }
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
                    { }, // target
                    {    // error
                        code:   'TYPE'
                    }
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
                        dog:        [ 9, 'O', 2, 1, 'O' ],
                        easy:       [ ]
                    },
                    { }, // target
                    {    // error
                        code:   'TYPE'
                    }
                );
            });

        });

        describe ("eval/async", function(){

            it ("fails when transforming synchronously with an asynchronous .eval", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.async':true, '.eval':function (value, callback) {
                            if (able === 'foobar')
                                return callback();
                            callback (new Error ('rejected!'));
                        }}
                    },
                    {    // source
                        able:       'foobar'
                    },
                    { }, // target
                    {    // error
                        code:   'SYNC'
                    }
                );
            });

            it ("fails when transforming with a failing .eval", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.eval':function (value) {
                            if (able === 'foobar')
                                throw new Error ('rejected!')
                        }}
                    },
                    {    // source
                        able:       'foobar'
                    },
                    { }, // target
                    {    // error
                        code:   'INVALID'
                    }
                );
            });

        });

        describe ("Objects", function(){

            it ("fails when transform exceeds max length", function(){
                testTransformFailure (
                    {    // schema
                        '.arbitrary':   true,
                        '.max':         3
                    },
                    {    // source
                        charlie:    'chunky',
                        dog:        7
                    },
                    {    // target
                        able:       42,
                        baker:      9001
                    },
                    {    // error
                        code:       'LIMIT'
                    }
                );
            });

            it ("fails when transform does not reach min length", function(){
                testTransformFailure (
                    {    // schema
                        '.arbitrary':   true,
                        '.min':         5
                    },
                    {    // source
                        charlie:    'charlie'
                    },
                    {    // target
                        able:       'able',
                        baker:      'baker'
                    },
                    {    // error
                        code:       'LIMIT'
                    }
                );
            });

            it ("fails when transform violates exact length", function(){
                testTransformFailure (
                    {    // schema
                        '.arbitrary':   true,
                        '.length':      5
                    },
                    {    // source
                        charlie:    'charlie'
                    },
                    {    // target
                        able:       'able',
                        baker:      'baker'
                    },
                    {    // error
                        code:       'LIMIT'
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
                    },
                    {    // error
                        code:       'MISSING'
                    }
                );
            });

            describe (".unique", function(){

                it ("accepts children with unique values");

                it ("rejects children with non-unique values");

                it ("rejects documents with non-unique mandatory children");

            });

        });

        describe ("Arrays", function(){

            it ("fails when transform exceeds max length", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'array', '.append':true, '.max':6 }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    },
                    {    // error
                        code:       'LIMIT'
                    }
                );
            });

            it ("fails when transform does not reach min length", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'array', '.append':true, '.min':9 }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    },
                    {    // error
                        code:       'LIMIT'
                    }
                );
            });

            it ("fails when transform violates exact length", function(){
                testTransformFailure (
                    {    // schema
                        able:       { '.type':'array', '.append':true, '.length':5 }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    },
                    {    // error
                        code:       'LIMIT'
                    }
                );
            });

            it ("processes a .sequence of transforms");

            it ("fails to transform due to one failing schema in a .sequence");

        });

        describe ("Strings", function(){

            it ("fails when transform exceeds max length", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'string', '.max':32 }
                    },
                    {    // source
                        able:   'This is my String. There are many like it, but this one is mine.'
                    },
                    {    // target
                        able:   'Hello, World!'
                    },
                    {    // error
                        code:   'INVALID'
                    }
                );
            });

            it ("fails when transform does not reach min length", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'string', '.min':32 }
                    },
                    {    // source
                        able:   'Hello, World!'
                    },
                    {    // target
                        able:   'This is my String. There are many like it, but this one is mine.'
                    },
                    {    // error
                        code:   'INVALID'
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
                    },
                    {    // error
                        code:   'INVALID'
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
                    },
                    {    // error
                        code:   'INVALID'
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
                    },
                    {    // error
                        code:   'INVALID'
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
                    },
                    {    // error
                        code:   'INVALID'
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
                    },
                    {    // error
                        code:   'INVALID'
                    }
                );
            });

        });

    });

    describe ("predicate constraints", function(){

        it ("rejects an Object transform that fails an .all constraint", function(){
            testTransformFailure (
                {    // schema
                    '.arbitrary':   true,
                    '.all':         {
                        '.type':        'number'
                    }
                },
                {    // source
                    able:       1,
                    baker:      'two'
                },
                {    // target
                    able:       9,
                    baker:      8,
                    charlie:    7
                },
                {    // error
                    code:   'INVALID'
                }
            );
            testTransformFailure (
                {    // schema
                    '.arbitrary':   true,
                    '.all':         {
                        '.type':        'number',
                        '.gte':         3
                    }
                },
                {    // source
                    able:       6,
                    baker:      2
                },
                {    // target
                    able:       9,
                    baker:      8,
                    charlie:    7
                },
                {    // error
                    code:   'INVALID'
                }
            );
        });

        it ("rejects an Array transform that fails an .all constraint", function(){
            testTransformFailure (
                {    // schema
                    '.type':        'array',
                    '.all':         {
                        '.type':        'number'
                    }
                },
                [ 1, 'two' ],
                [ 9, 8, 7 ],
                {    // error
                    code:   'INVALID'
                }
            );
            testTransformFailure (
                {    // schema
                    '.type':        'array',
                    '.all':         {
                        '.type':        'number',
                        '.gte':         3
                    }
                },
                [ 6, 2 ],
                [ 9, 8, 7 ],
                {    // error
                    code:   'INVALID'
                }
            );
        });

    });

    describe ("transforms", function(){

        describe ("function transforms", function(){

            it ("performs a function transform", function(){
                testTransform (
                    {    // schema
                        able:   { '.type':'string', '.transform':function (value) {
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

            it ("rejects an async function transform called synchronously", function(){
                testTransformFailure (
                    {    // schema
                        able:   {
                            '.type':        'string',
                            '.async':       true,
                            '.transform':   function (value, callback) {
                                callback (
                                    undefined,
                                    '<' + value + ' class="foo"></' + value + '>\n'
                                );
                            }
                        }
                    },
                    {    // source
                        able:   'div'
                    },
                    { }, // target
                    {    // error
                        code:   'SYNC'
                    }
                );
            });

            it ("wraps an Error thrown by the function transform", function(){
                testTransformFailure (
                    {    // schema
                        able:   { '.type':'string', '.transform':function (value) {
                            throw new Error ('nope!');
                        }}
                    },
                    {    // source
                        able:   'div'
                    },
                    { }, // target
                    {    // error
                        code:   'INVALID'
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
                        { }, // target
                        {    // error
                            code:   'FORMAT'
                        }
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
                            able:   { '.type':'number', '.total':true },
                            baker:  { '.type':'number', '.total':true }
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
                            able:   { '.type':'number', '.total':true }
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
                            able:       { '.type':'number', '.max':100, '.total':true },
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
                            able:       { '.type':'number', '.max':10, '.total':true },
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
                        {    // error
                            path:       'able',
                            code:       'INVALID'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.max':100, '.total':true },
                            baker:      { '.type':'number', '.min':10, '.subtract':true },
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
                        {    // error
                            path:       'baker',
                            code:       'INVALID'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.max':100, '.total':true },
                            baker:      { '.type':'number', '.min':3, '.subtract':true },
                            charlie:    { '.type':'number', '.max':8, '.multiply':true },
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
                            path:       'charlie',
                            code:       'INVALID'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.max':100, '.total':true },
                            baker:      { '.type':'number', '.min':3, '.subtract':true },
                            charlie:    { '.type':'number', '.max':100, '.multiply':true },
                            dog:        { '.type':'number', '.min':10, '.divide':true },
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
                            path:       'dog',
                            code:       'INVALID'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.max':100, '.total':true },
                            baker:      { '.type':'number', '.min':3, '.subtract':true },
                            charlie:    { '.type':'number', '.max':100, '.multiply':true },
                            dog:        { '.type':'number', '.min':0, '.divide':true },
                            easy:       { '.type':'number', '.max':6, '.modulo':7 },
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
                            path:       'easy',
                            code:       'INVALID'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.max':100, '.total':true },
                            baker:      { '.type':'number', '.min':3, '.subtract':true },
                            charlie:    { '.type':'number', '.max':100, '.multiply':true },
                            dog:        { '.type':'number', '.min':0, '.divide':true },
                            easy:       { '.type':'number', '.max':7, '.modulate':7 },
                            fox:        { '.type':'number', '.min':0, '.inverse':true },
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
                            path:       'fox',
                            code:       'INVALID'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:       { '.type':'number', '.max':100, '.total':true },
                            baker:      { '.type':'number', '.min':3, '.subtract':true },
                            charlie:    { '.type':'number', '.max':100, '.multiply':true },
                            dog:        { '.type':'number', '.min':0, '.divide':true },
                            easy:       { '.type':'number', '.max':7, '.modulate':7 },
                            fox:        { '.type':'number', '.max':0, '.inverse':true },
                            george:     { '.type':'number', '.max':0, '.reciprocal':true }
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
                            path:       'george',
                            code:       'INVALID'
                        }
                    );
                });

            });

            describe ("post-transform .all", function(){

                it ("proceeds when post-transform Numbers pass .all constraint", function(){
                    testTransform (
                        {    // schema
                            '.arbitrary':   true,
                            '.all':         {
                                '.type':        'number',
                                '.lte':         10
                            },
                            able:           {
                                '.type':        'number',
                                '.normal':      5
                            }
                        },
                        {    // source
                            able:       45
                        },
                        { }, // target
                        {    // goal
                            able:       9
                        }
                    );
                });

                it ("proceeds when post in-place math Numbers pass .all constraint", function(){
                    testTransform (
                        {    // schema
                            '.arbitrary':   true,
                            '.all':         {
                                '.type':        'number',
                                '.lte':         10
                            },
                            able:           {
                                '.type':        'number',
                                '.subtract':    true
                            }
                        },
                        {    // source
                            able:       45
                        },
                        {    // target
                            able:       50
                        },
                        {    // goal
                            able:       5
                        }
                    );
                });

                it ("fails when post-transform Numbers fail .all constraint", function(){
                    testTransformFailure (
                        {    // schema
                            '.arbitrary':   true,
                            '.all':         {
                                '.type':        'number',
                                '.lte':         10
                            },
                            able:           {
                                '.type':        'number',
                                '.normal':      5
                            }
                        },
                        {    // source
                            able:       55
                        },
                        { }, // target
                        {    // error
                            code:       'INVALID'
                        }
                    );
                });

                it ("fails when post in-place math Numbers fail .all constraint", function(){
                    testTransformFailure (
                        {    // schema
                            '.arbitrary':   true,
                            '.all':         {
                                '.type':        'number',
                                '.lte':         10
                            },
                            able:           {
                                '.type':        'number',
                                '.subtract':    true
                            }
                        },
                        {    // source
                            able:       45
                        },
                        {    // target
                            able:       60
                        },
                        {    // error
                            code:       'INVALID'
                        }
                    );
                });

            });

        });

        describe ("Strings", function(){

            describe (".split", function(){

                it ("splits using a regular expression", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'array', '.split':/,\s*/g }
                        },
                        {    // source
                            able:   'this, and,  \tlike, another one.'
                        },
                        { }, // target
                        {    // goal
                            able:   [ 'this', 'and', 'like', 'another one.' ]
                        }
                    );
                });

                it ("splits using a grouping regular expression", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'array', '.split':/,(\s*)/g }
                        },
                        {    // source
                            able:   'this, and,  \tlike, another one.'
                        },
                        { }, // target
                        {    // goal
                            able:   [ 'this', ' ', 'and', '  \t', 'like', ' ', 'another one.' ]
                        }
                    );
                });

            });

            describe (".group", function(){

                it ("groups using a regular expression", function(){
                    testTransform (
                        {    // schema
                            able:  { '.type':'array', '.group':/\s*[Ss]trings?(\.?\s*)/g }
                        },
                        {    // source
                            able:   'We string the String until it is strung into multiple Strings.'
                        },
                        { }, // target
                        {    // goal
                            able:   [ ' string ', ' ', ' String ', ' ', ' Strings.', '.' ]
                        }
                    );
                });

            });

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
                                '.max':         20
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
                                '.max':         15
                            }
                        },
                        {    // source
                            able:   'cheese'
                        },
                        {    // target
                            able:   ' factory'
                        },
                        {    // error
                            code:   'INVALID'
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
                        },
                        {    // error
                            code:   'INVALID'
                        }
                    );
                });

            });

            describe ("post-transform .all", function(){

                it ("proceeds when post-transform Strings pass .all constraint", function(){
                    testTransform (
                        {    // schema
                            '.arbitrary':   true,
                            '.all':         {
                                '.type':        'string',
                                '.min':         14
                            },
                            able:           {
                                '.type':        'string',
                                '.inject':      [ [ 0, ' PADDING ' ] ]
                            }
                        },
                        {    // source
                            able:       'cheese'
                        },
                        { }, // target
                        {    // goal
                            able:       ' PADDING cheese'
                        }
                    );
                });

                it ("proceeds when post in-place Strings pass .all constraint", function(){
                    testTransform (
                        {    // schema
                            '.arbitrary':   true,
                            '.all':         {
                                '.type':        'string',
                                '.min':         16
                            },
                            able:           {
                                '.type':        'string',
                                '.append':      true
                            }
                        },
                        {    // source
                            able:       'fromage bleu'
                        },
                        {    // target
                            able:       'le chez '
                        },
                        {    // goal
                            able:       'le chez fromage bleu'
                        }
                    );
                });

                it ("fails when post-transform Strings fail .all constraint", function(){
                    testTransformFailure (
                        {    // schema
                            '.arbitrary':   true,
                            '.all':         {
                                '.type':        'string',
                                '.max':         16
                            },
                            able:           {
                                '.type':        'string',
                                '.inject':      [ [ 0, ' PADDING ' ] ]
                            }
                        },
                        {    // source
                            able:       'This is my String. There are many like it but this one is mine.'
                        },
                        { }, // target
                        {    // error
                            code:       'INVALID'
                        }
                    );
                });

                it ("fails when post in-place strings fail .all constraint", function(){
                    testTransformFailure (
                        {    // schema
                            '.arbitrary':   true,
                            '.all':         {
                                '.type':        'string',
                                '.max':         16
                            },
                            able:           {
                                '.type':        'string',
                                '.append':      true
                            }
                        },
                        {    // source
                            able:       'This is my String. There are many like it but this one is mine.'
                        },
                        {    // target
                            able:       'prayer: '
                        },
                        {    // error
                            code:       'INVALID'
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
                            able:   'False'
                        },
                        { }, // target
                        {    // goal
                            able:   false
                        }
                    );
                    testTransform (
                        {    // schema
                            able:   { '.type':'boolean', '.cast':true }
                        },
                        {    // source
                            able:   'TRUE'
                        },
                        { }, // target
                        {    // goal
                            able:   true
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
                        { }, // target
                        {    // error
                            code:   'FORMAT'
                        }
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
                        { }, // target
                        {    // error
                            code:   'FORMAT'
                        }
                    );

                    testTransformFailure (
                        {    // schema
                            able:   { '.type':'object', '.cast':true }
                        },
                        {    // source
                            able:   '[ 0, 1, 2, { able:"foo" } ]'
                        },
                        { }, // target
                        {    // error
                            code:   'FORMAT'
                        }
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

            describe (".insert", function(){

                it ("inserts input Object's keys into a child key", function(){
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.arbitrary':   true,
                            '.insert':      'able'
                        },
                        {    // source
                            able:   9001,
                            baker:  'nine thousand and one'
                        },
                        { }, // target
                        {    // goal
                            able:   {
                                able:   9001,
                                baker:  'nine thousand and one'
                            }
                        }
                    );
                });

                it ("processes the input Object as the inserted child key", function(){
                    testTransform (
                        {    // schema
                            '.insert':      'userInput',
                            userInput:      {
                                able:           {
                                    '.type':        'number',
                                    '.gte':         0,
                                    '.lte':         10,
                                    '.normalize':   10
                                },
                                baker:          /^\w+$/
                            }
                        },
                        {    // source
                            able:       9,
                            baker:      'hello'
                        },
                        { }, // target
                        {    // goal
                            userInput:  {
                                able:       0.9,
                                baker:      'hello'
                            }
                        }
                    );
                });

                it ("injects before insertion", function(){
                    testTransform (
                        {    // schema
                            '.insert':      'userInput',
                            '.inject':      [
                                [ 'cheese', 'parmesan' ]
                            ],
                            userInput:      {
                                able:           {
                                    '.type':        'number',
                                    '.gte':         0,
                                    '.lte':         10,
                                    '.normalize':   10
                                },
                                baker:          /^\w+$/,
                                cheese:         { '.type':'string' }
                            }
                        },
                        {    // source
                            able:       9,
                            baker:      'hello'
                        },
                        { }, // target
                        {    // goal
                            userInput:  {
                                able:       0.9,
                                baker:      'hello',
                                cheese:     'parmesan'
                            }
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
                            able:   9001,
                            baker:  'nine thousand and one'
                        },
                        { }, // target
                        {    // goal
                            baker:  9001
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
                            '.max':         4,
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
                        },
                        {    // error
                            code:       'LIMIT'
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
                        { }, // target
                        {    // error
                            code:   'FORMAT'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            able:   { '.type':'array', '.cast':true }
                        },
                        {    // source
                            able:   '{ "able":"foo", "baker":{ "able:9001" }}'
                        },
                        { }, // target
                        {    // error
                            code:   'FORMAT'
                        }
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

                it ("inserts to the correct position when using a simple .sort");

                it ("inserts to the correct position when using a complex .sort");

                it ("inserts only novel values with .unique");

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

                it ("inserts to the correct position when using a simple .sort");

                it ("inserts to the correct position when using a complex .sort");

                it ("appends only novel values with .unique");

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

                it ("inserts to the correct position when using a simple .sort");

                it ("inserts to the correct position when using a complex .sort");

                it ("prepends only novel values with .unique");

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

            describe (".slice", function(){

                it ("keeps only a slice of elements from the target", function(){
                    testTransform (
                        {    // schema
                            '.type':    'array',
                            '.slice':   [ 4, 8 ]
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [ ], // target
                        [    // goal
                            4, 5, 6, 7
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
                            '.max':     15
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        {    // error
                            code:       'LIMIT'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            '.type':    'array',
                            '.prepend': true,
                            '.max':     15
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        {    // error
                            code:       'LIMIT'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            '.type':    'array',
                            '.insert':  5,
                            '.max':     15
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [    // target
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        {    // error
                            code:       'LIMIT'
                        }
                    );
                    testTransformFailure (
                        {    // schema
                            '.type':    'array',
                            '.inject':  [
                                [ 1, 9 ],
                                [ 3, 9 ],
                                [ 5, 9 ]
                            ],
                            '.max':     11
                        },
                        [    // source
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                        ],
                        [ ], // target
                        {    // error
                            code:       'LIMIT'
                        }
                    );
                });

            });

        });

    });

    describe ("anyOf", function(){

        it ("transforms with one of several schema", function(){
            testTransform (
                { able:{
                    able:{ '.type':'number' },
                    '.anyOf':[
                        { able:{ '.type':'number', '.max':3, '.add':true } },
                        { able:{ '.type':'number', '.min':0, '.subtract':true } },
                        { able:{ '.type':'number', '.max':60, '.multiply':true } },
                        { able:{ '.type':'number', '.min':6, '.divide':true } }
                    ]
                } },
                { able:{ able:10 } },
                { able:{ able:5 } }
            );
        });

        it ("fails to transform with any of several schema", function(){
            testTransformFailure (
                { able:{
                    able:{ '.type':'number' },
                        '.anyOf':[
                        { able:{ '.type':'number', '.max':3, '.add':true } },
                        { able:{ '.type':'number', '.min':0, '.subtract':true } },
                        { able:{ '.type':'number', '.max':40, '.multiply':true } },
                        { able:{ '.type':'number', '.min':6, '.divide':true } }
                    ]
                } },
                { able:{ able:10 } },
                { able:{ able:5 } },
                { code:'FORMAT' }
            );
        });

    });

    describe ("oneOf", function(){

        it ("transforms with one of several schema", function(){
            testTransform (
                { able:{
                    able:{ '.type':'number' },
                    '.oneOf':[
                        { able:{ '.type':'number', '.max':3, '.add':true } },
                        { able:{ '.type':'number', '.min':0, '.subtract':true } },
                        { able:{ '.type':'number', '.max':60, '.multiply':true } },
                        { able:{ '.type':'number', '.min':6, '.divide':true } }
                    ]
                } },
                { able:{ able:10 } },
                { able:{ able:5 } }
            );
        });

        it ("fails to transform with any of several schema", function(){
            testTransform (
                { able:{
                    able:{ '.type':'number' },
                    '.oneOf':[
                        { able:{ '.type':'number', '.max':3, '.add':true } },
                        { able:{ '.type':'number', '.min':0, '.subtract':true } },
                        { able:{ '.type':'number', '.max':40, '.multiply':true } },
                        { able:{ '.type':'number', '.min':6, '.divide':true } }
                    ]
                } },
                { able:{ able:10 } },
                { able:{ able:5 } }
            );
        });

        it ("fails to transform due to too many passing schema", function(){
            testTransform (
                { able:{
                    able:{ '.type':'number' },
                    '.oneOf':[
                        { able:{ '.type':'number', '.max':3, '.add':true } },
                        { able:{ '.type':'number', '.min':0, '.subtract':true } },
                        { able:{ '.type':'number', '.max':60, '.multiply':true } },
                        { able:{ '.type':'number', '.min':1, '.divide':true } }
                    ]
                } },
                { able:{ able:10 } },
                { able:{ able:5 } }
            );
        });

    });

    describe ("not", function(){

        it ("fails to transform when the inverse schema validates", function(){
            testTransform (
                { able:{
                    able:{ '.type':'number' },
                    '.not':{ able:{ '.type':'number', '.gt':40, '.lt':60 } }
                } },
                { able:{ able:10 } },
                { able:{ able:5 } }
            );
        });

    });

});
