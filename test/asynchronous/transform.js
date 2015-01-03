
var Likeness = require ('../../Likeness');
var TransformError = Likeness.errors.TransformError;
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

function testTransform (schema, source, target, goal, callback) {
    schema = new Likeness (schema);
    var sourceStr = JSON.stringify (source);
    var sync = true;
    try {
        schema.transform (source, target, function (err, val) {
            if (err)
                return callback (new Error (JSON.stringify (err)));
            if (sync)
                return callback (new Error ('callback fired synchronously'));
            if (sourceStr != JSON.stringify (source))
                return callback (new Error ('transform damaged the source object'));
            if (!deepCompare (target, goal))
                return callback (new Error ('goal did not match - '+JSON.stringify (target)));
            callback();
        });
    } catch (err) {
        return callback (new Error ('Error thrown synchronously - ' + JSON.stringify (err)));
    }
    sync = false;
}

function testTransformFailure (schema, source, target, error, callback) {
    schema = new Likeness (schema);
    var sourceStr = JSON.stringify (source);
    var sync = true;
    try {
        schema.transform (source, target, function (err, val) {
            if (sync)
                return callback (new Error ('callback fired synchronously'));
            if (sourceStr != JSON.stringify (source))
                return callback (new Error ('transform damaged the source object'));
            if (!err)
                return callback (new Error ('transform completed erroneously'));
            if (error)
                // shallow compare own properties on err and error
                for (var key in error)
                    if (!Object.hasOwnProperty.call (err, key) || err[key] !== error[key])
                        return callback (new Error (
                            'thrown error property "'
                          + key
                          + '": '
                          + err[key]
                          + ' != '
                          + error[key]
                        ));
            return callback();
        });
    } catch (err) {
        return callback (new Error ('Error thrown synchronously - ' + JSON.stringify (err)));
    }
    sync = false;
}

describe ("#transform", function(){
    describe (".arbitrary", function(){
        it ('blindly duplicates an object with an arbitrary schema', function (done) {
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
                },
                done
            );
        });

        it ('merges into the target correctly', function (done) {
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
                },
                done
            );
        });

        it ('applies .all transforms to every child', function (done) {
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
                },
                done
            );
        });

        it ('refuses to duplicate with empty schema', function (done) {
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
                },
                done
            );
        });
    });

    describe (".tolerant", function(){
        it ("ignores unknown keys in the input", function (done) {
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
                },
                done
            );
        });
    });

    describe ("simple constraints", function(){
        describe ("type", function(){
            it ("rejects updates of mismatched type", function (done) {
                async.parallel ([
                    function (next) {
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
                            },
                            next
                        );
                    },
                    function (next) {
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
                            },
                            next
                        );
                    },
                    function (next) {
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
                            },
                            next
                        );
                    },
                    function (next) {
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
                            },
                            next
                        );
                    },
                    function (next) {
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
                            },
                            next
                        );
                    }
                ], done);
            });
        });

        describe ("eval/async", function(){
            it ("fails when transforming with a failing .eval", function (done) {
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
                    },
                    done
                );
            });
        });

        describe ("Object max/length", function(){
            it ("fails when transform exceeds max length", function (done) {
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
                    },
                    done
                );
            });

            it ("completes when transform does not reach min length", function (done) {
                testTransform (
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
                    {    // goal
                        able:       'able',
                        baker:      'baker',
                        charlie:    'charlie'
                    },
                    done
                );
            });

            it ("completes when transform violates exact length", function (done) {
                testTransform (
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
                    {    // goal
                        able:       'able',
                        baker:      'baker',
                        charlie:    'charlie'
                    },
                    done
                );
            });
        });

        describe ("Array max/length", function(){
            it ("fails when transform exceeds max length", function (done) {
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
                    },
                    done
                );
            });

            it ("completes when transform does not reach min length", function (done) {
                testTransform (
                    {    // schema
                        able:       { '.type':'array', '.append':true, '.min':9 }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    },
                    {    // goal
                        able:       [ 0, 1, 2, 3, 4, 9, 9, 9 ]
                    },
                    done
                );
            });

            it ("completes when transform violates exact length", function (done) {
                testTransform (
                    {    // schema
                        able:       { '.type':'array', '.append':true, '.length':5 }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    },
                    {    // goal
                        able:       [ 0, 1, 2, 3, 4, 9, 9, 9 ]
                    },
                    done
                );
            });
        });

        describe ("String length/match", function(){
            it ("fails when transform exceeds max length", function (done) {
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
                    },
                    done
                );
            });

            it ("fails when transform does not reach min length", function (done) {
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
                    },
                    done
                );
            });

            it ("fails when transform violates exact length", function (done) {
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
                    },
                    done
                );
            });
        });

        describe ("Numbers min/max/modulo", function(){
            it ("fails when transform is equal to exclusive max", function (done) {
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
                    },
                    done
                );
            });

            it ("fails when transform is equal to exclusive min", function (done) {
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
                    },
                    done
                );
            });

            it ("fails when transform is above max", function (done) {
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
                    },
                    done
                );
            });

            it ("fails when transform is below min", function (done) {
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
                    },
                    done
                );
            });
        });
    });

    describe ("predicate constraints", function(){
        it ("rejects an Object transform that fails an .all constraint", function (done) {
            async.parallel ([
                function (next) {
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
                        },
                        next
                    );
                },
                function (next) {
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
                        },
                        next
                    );
                }
            ], done);
        });

        it ("rejects an Array transform that fails an .all constraint", function (done) {
            async.parallel ([
                function (next) {
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
                        },
                        next
                    );
                },
                function (next) {
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
                        },
                        next
                    );
                }
            ], done);
        });
    });

    describe ("transforms", function(){
        describe ("function transforms", function(){
            it ("performs a function transform", function (done) {
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
                    },
                    done
                );
            });

            it ("wraps an Error thrown by the function transform", function (done) {
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
                    },
                    done
                );
            });
        });

        describe ("Numbers", function(){
            describe (".cast", function(){
                it ("casts Strings to Numbers", function (done) {
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
                        },
                        done
                    );
                });

                it ("rejects invalid Number Strings", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe ("normalization", function(){
                it ("normalizes Numbers", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe ("in-place math", function(){
                it ("adds", function (done) {
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
                        },
                        done
                    );
                });

                it ("adds to missing target", function (done) {
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
                        },
                        done
                    );
                });

                it ("subtracts", function (done) {
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
                        },
                        done
                    );
                });

                it ("subtracts from missing target", function (done) {
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
                        },
                        done
                    );
                });

                it ("multiplies", function (done) {
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
                        },
                        done
                    );
                });

                it ("multiplies with missing target", function (done) {
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
                        },
                        done
                    );
                });

                it ("divides target by input", function (done) {
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
                        },
                        done
                    );
                });

                it ("divides missing target by input", function (done) {
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
                        },
                        done
                    );
                });
            });

            it ("filters by modulo", function (done) {
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
                    },
                    done
                );
            });

            it ("inverts", function (done) {
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
                    },
                    done
                );
            });

            it ("reciprocates", function (done) {
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
                    },
                    done
                );
            });

            describe ("post-transform (l|g)t(e)", function(){
                it ("selects when post-transform Numbers are within bounds", function (done) {
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
                        },
                        done
                    );
                });

                it ("rejects when post-transform Numbers are out of bounds", function (done) {
                    async.parallel ([
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        }
                    ], done);
                });
            });

            describe ("post-transform .all", function(){
                it ("proceeds when post-transform Numbers pass .all constraint", function (done) {
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
                        },
                        done
                    );
                });

                it ("proceeds when post in-place math Numbers pass .all constraint", function (done) {
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
                        },
                        done
                    );
                });

                it ("fails when post-transform Numbers fail .all constraint", function (done) {
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
                        },
                        done
                    );
                });

                it ("fails when post in-place math Numbers fail .all constraint", function (done) {
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
                        },
                        done
                    );
                });
            });
        });

        describe ("Strings", function(){
            describe (".split", function(){
                it ("splits using a regular expression", function (done) {
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
                        },
                        done
                    );
                });

                it ("splits using a grouping regular expression", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".group", function(){
                it ("groups using a regular expression", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".inject", function(){
                it ("injects a String into the input", function (done) {
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
                        },
                        done
                    );
                });

                it ("appends a String onto the input", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".insert", function(){
                it ("inserts the input into the target", function (done) {
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
                        },
                        done
                    );
                });

                it ("inserts the input into missing target", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".append", function(){
                it ("appends the input onto the target", function (done) {
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
                        },
                        done
                    );
                });

                it ("appends the input onto missing target", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".prepend", function(){
                it ("prepends the input onto the target", function (done) {
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
                        },
                        done
                    );
                });

                it ("prepends the input onto missing target", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".case", function(){
                it ("uppercase converts the input", function (done) {
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
                        },
                        done
                    );
                });

                it ("lowercase converts the input", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe ("post-transform .max", function(){
                it ("proceeds when post-transform String is within bounds", function (done) {
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
                        },
                        done
                    );
                });

                it ("fails when post-transform String is out of bounds", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe ("post-transform .regex match", function(){
                it ("proceeds when post-transform String matches a regex filter", function (done) {
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
                        },
                        done
                    );
                });

                it ("fails when post-transform String does not match a regex filter", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe ("post-transform .all", function(){
                it ("proceeds when post-transform Strings pass .all constraint", function (done) {
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
                        },
                        done
                    );
                });

                it ("proceeds when post in-place Strings pass .all constraint", function (done) {
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
                        },
                        done
                    );
                });

                it ("fails when post-transform Strings fail .all constraint", function (done) {
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
                        },
                        done
                    );
                });

                it ("fails when post in-place strings fail .all constraint", function (done) {
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
                        },
                        done
                    );
                });
            });
        });

        describe ("Booleans", function(){
            describe (".cast", function(){
                it ("casts Strings to Booleans", function (done) {
                    async.parallel ([
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        }
                    ], done);
                });

                it ("rejects invalid Boolean Strings", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".inverse", function(){
                it ("inverts booleans", function (done) {
                    testTransform (
                        { able:{ '.type':'boolean', '.inverse':true }},
                        { able:true },
                        {},
                        { able:false },
                        done
                    );
                });
            });
        });

        describe ("Objects", function(){
            describe (".cast", function(){
                it ("casts JSON Strings to Objects", function (done) {
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
                        },
                        done
                    );
                });

                it ("rejects invalid JSON", function (done) {
                    async.parallel ([
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        }
                    ], done);
                });
            });

            describe (".inject", function(){
                it ("injects keys into the input", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".insert", function(){
                it ("inserts input Object's keys into a child key", function (done) {
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
                        },
                        done
                    );
                });

                it ("processes the input Object as the inserted child key", function (done) {
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
                        },
                        done
                    );
                });

                it ("injects before insertion", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".rename", function(){
                it ("renames keys", function (done) {
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
                        },
                        done
                    );
                });

                it ("clobbers keys in the source", function (done) {
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
                        },
                        done
                    );
                });

                it ("processes keys with their new names", function (done) {
                    testTransform (
                        {    // schema
                            '.type':        'object',
                            '.rename':      {
                                able:           'baker'
                            },
                            able:           { '.type':'string' },
                            baker:          { '.type':'number' }
                        },
                        {    // source
                            able:   9001
                        },
                        { }, // target
                        {    // goal
                            baker:  9001
                        },
                        done
                    );
                });
            });

            describe (".drop", function(){
                it ("drops keys from the input", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".clip", function(){
                it ("keeps only the newest keys from the target document", function (done) {
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
                        },
                        done
                    );
                });

                it ("keeps only the oldest keys from the target document", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe ("post-transform .max", function(){
                it ("fails when a post-injection source violates a .max constraint", function (done) {
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
                        },
                        done
                    );
                });
            });
        });

        describe ("Arrays", function(){
            describe (".cast", function(){
                it ("casts JSON Strings to Arrays", function (done) {
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
                        },
                        done
                    );
                });

                it ("rejects invalid JSON", function (done) {
                    async.parallel ([
                        function (callback) {
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
                                },
                                callback
                            );
                        },
                        function (callback) {
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
                                },
                                callback
                            );
                        }
                    ], done);
                });
            });

            describe (".inject", function(){
                it ("adds values to the input", function (done) {
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
                        },
                        done
                    );
                });

                it ("splices values into the input", function (done) {
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
                        },
                        done
                    );
                });

                it ("splices values in order", function (done) {
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
                        },
                        done
                    );
                });
            });

            describe (".insert", function(){
                it ("inserts input values into the target", function (done) {
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
                        ],
                        done
                    );
                });

                it ("inserts input values into empty target", function (done) {
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
                        ],
                        done
                    );
                });

                it ("inserts input values into missing target", function (done) {
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
                        },
                        done
                    );
                });

                it ("injects before insertion", function (done) {
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
                        ],
                        done
                    );
                });
            });

            describe (".append", function(){
                it ("appends input values to the target", function (done) {
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
                        ],
                        done
                    );
                });

                it ("injects before appending", function (done) {
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
                        ],
                        done
                    );
                });
            });

            describe (".prepend", function(){
                it ("prepends input values to the target", function (done) {
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
                        ],
                        done
                    );
                });

                it ("injects before prepending", function (done) {
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
                        ],
                        done
                    );
                });
            });

            describe (".clip", function(){
                it ("keeps only the last elements of the target", function (done) {
                    async.parallel ([
                        function (next) {
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
                                ],
                                next
                            );
                        },
                        function (next) {
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
                                ],
                                next
                            );
                        }
                    ], done);
                });

                it ("keeps only the first elements of the target", function (done) {
                    async.parallel ([
                        function (next) {
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
                                ],
                                next
                            );
                        },
                        function (next) {
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
                                ],
                                next
                            );
                        }
                    ], done);
                });
            });

            describe (".slice", function(){
                it ("keeps only a slice of elements from the target", function (done) {
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
                        ],
                        done
                    );
                });
            });

            describe ("post-transform .max", function(){
                it ("rejects element counts not within bounds after transform", function (done) {
                    async.parallel ([
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        },
                        function (next) {
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
                                },
                                next
                            );
                        }
                    ], done);
                });
            });
        });
    });

});
