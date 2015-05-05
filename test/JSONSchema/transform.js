
var likeness = require ('../../likeness');
var assert = require ('assert');
var async = require ('async');
var getTypeStr = require ('../../lib/GetTypeStr');

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

var RE_LINE = new RegExp ('transform\\.js:(\\d+)', 'g');
function testTransform (schema, source, target, goal, callback) {
    schema.$schema = 'http://json-schema.org/likeness/transform';

    // debugger block - prints line number of calling test
    // var stack = (new Error()).stack;
    // var match, lineNumber;
    // while (match = RE_LINE.exec (stack))
    //     lineNumber = match[1];
    // if (lineNumber)
    //     console.log ('ln:'+lineNumber);

    var context = new likeness.helpers.JSContext();
    context.compile (schema, function (err, compiled, metaschema) {
        if (err) return callback (err);
        likeness.helpers.fromJSONSchema (metaschema, compiled, function (err, likeDoc) {
            if (err) return callback (err);

            var likeInstance = new likeness (likeDoc);
            var sourceStr = JSON.stringify (source);
            var targetStr = JSON.stringify (target);

            try {
                var result = likeInstance.transform (target, source);
            } catch (err) {
                return callback (new Error ('transform failed - '+err));
            }

            if (sourceStr != JSON.stringify (source))
                return callback (new Error ('transform damaged the source object'));
            if (targetStr != JSON.stringify (target))
                return callback (new Error ('transform damaged the target object'));
            if (!deepCompare (result, goal)) {
                return callback (new Error ('goal did not match - '+JSON.stringify (result)));
            }

            callback();
        });
    });
}

function testTransformFailure (schema, source, target, callback) {
    schema.$schema = 'http://json-schema.org/likeness/transform';

    var context = new likeness.helpers.JSContext();
    context.compile (schema, function (err, compiled, metaschema) {
        if (err) return callback (err);
        likeness.helpers.fromJSONSchema (metaschema, compiled, function (err, likeDoc) {
            if (err) return callback (err);

            var likeInstance = new likeness (likeDoc);
            var sourceStr = JSON.stringify (source);
            var targetStr = JSON.stringify (target);

            try {
                var result = likeInstance.transform (target, source);
                return callback (new Error ('transform completed erroneously'));
            } catch (err) {
                if (typeof err != 'string')
                    return callback (err);
                if (sourceStr != JSON.stringify (source))
                    return callback (new Error ('transform damaged the source object'));
                if (targetStr != JSON.stringify (target))
                    return callback (new Error ('transform damaged the target object'));
            }

            callback();
        });
    });
}

describe ("transform (likeness extensions)", function(){

    it ("throws custom errors", function (done) {
        var schema = {
            $schema:    'http://json-schema.org/likeness/transform',
            type:       'object',
            properties: { able:{
                type:               'number',
                maximum:            9000,
                exclusiveMaximum:   true,
                error:              "It's over nine thousand!!!!!!"
            } }
        };
        var context = new likeness.helpers.JSContext();
        context.compile ('https://foo.bar.com/test-schema', schema, function (err, compiled, metaschema) {
            if (err) return done (err);
            likeness.helpers.fromJSONSchema (metaschema, compiled, function (err, likeDoc) {
                if (err) return done (err);
                var likeInstance = new likeness (likeDoc);
                try {
                    likeInstance.transform ({ able:9015 });
                    return done (new Error ('failed to reject document'));
                } catch (err) {
                    if (err !== "It's over nine thousand!!!!!!")
                        return done (new Error ('incorrect error thrown'));
                }
                done();
            });
        });
    });

    describe ("tolerant", function(){

        it ("ignores unknown keys in the input", function (done) {
            testTransform (
                {    // schema
                    tolerant:       true,
                    properties:     {
                        able:           { type:'number' },
                        charlie:        { type:'string' },
                        easy:           { type:'string' }
                    }
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

    describe ("constraints", function(){

        describe ("Objects", function(){

            it ("fails when transform exceeds max length", function (done) {
                testTransformFailure (
                    {    // schema
                        maxProperties: 3
                    },
                    {    // source
                        charlie:    'chunky',
                        dog:        7
                    },
                    {    // target
                        able:       42,
                        baker:      9001
                    },
                    done
                );
            });

            it ("fails when transform does not reach min length", function (done) {
                testTransformFailure (
                    {    // schema
                        minProperties: 5
                    },
                    {    // source
                        charlie:    'charlie'
                    },
                    {    // target
                        able:       'able',
                        baker:      'baker'
                    },
                    done
                );
            });

            it ("fails when transform violates exact length", function (done) {
                testTransformFailure (
                    {    // schema
                        numProperties: 5
                    },
                    {    // source
                        charlie:    'charlie'
                    },
                    {    // target
                        able:       'able',
                        baker:      'baker'
                    },
                    done
                );
            });

            it ("fails when mandatory children are not filled", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:       { type:'string' },
                            baker:      { type:'string' },
                            charlie:    { type:'string' },
                            dog:        { type:'string' },
                            easy:       { type:'string' }
                        },
                        required: [ 'able', 'baker', 'charlie', 'dog', 'easy' ]
                    },
                    {    // source
                        baker:      'baker',
                        dog:        'dog'
                    },
                    {    // target
                        able:       'able',
                        charlie:    'baker'
                    },
                    done
                );
            });

            it ("transforms with patternProperties", function (done) {
                testTransform (
                    {
                        patternProperties: {
                            '^a.*':{ type:'number' },
                            '^b.*':{ type:'string' }
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
                    },
                    done
                );
            });

            describe ("uniqueProperties", function(){

                it ("transforms the document when uniqueProperties is satisfied", function (done) {
                    testTransform (
                        { uniqueProperties:true },
                        { able:1, baker:'1', charlie:{ able:1 }, dog:{ able:'1' } },
                        { },
                        { able:1, baker:'1', charlie:{ able:1 }, dog:{ able:'1' } },
                        done
                    );
                });

                it ("rejects the document when uniqueProperties is not satisfied", function (done) {
                    async.parallel ([
                        function (callback) {
                            testTransformFailure (
                                { uniqueProperties:true },
                                { able:1, baker:'1', charlie:{ able:1 }, dog:{ able:'1' }, easy:{ able:'1' } },
                                { },
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                { uniqueProperties:true, forAll:{ type:'number' } },
                                { able:1, baker:2, charlie:2 },
                                { },
                                callback
                            );
                        }
                    ], done);
                });

            });

        });

        describe ("Arrays", function(){

            it ("fails when transform exceeds max length", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:       { type:'array', append:true, maxItems:6 }
                        }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    },
                    done
                );
            });

            it ("fails when transform does not reach min length", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:       { type:'array', append:true, minItems:9 }
                        }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    },
                    done
                );
            });

            it ("fails when transform violates exact length", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:       { type:'array', append:true, numItems:6 }
                        }
                    },
                    {    // source
                        able:       [ 9, 9, 9 ]
                    },
                    {    // target
                        able:       [ 0, 1, 2, 3, 4 ]
                    },
                    done
                );
            });

            it ("processes a sequence of transforms", function (done) {
                testTransform (
                    { items :[
                        { type:'number', add:true },
                        { type:'number', subtract:true },
                        { type:'number', multiply:true },
                        { type:'number', divide:true }
                    ] },
                    [ 10, 10, 10, 10 ],
                    [ 100, 100, 100, 100 ],
                    [ 110, 90, 1000, 10 ],
                    done
                );
            });

            it ("fails to transform due to one failing schema in a .sequence", function (done) {
                testTransformFailure (
                    { items :[
                        { type:'number', add:true },
                        { type:'number', subtract:true },
                        { type:'number', multiply:true },
                        { type:'number', divide:true }
                    ] },
                    [ 10, 10, "10", 10 ],
                    [ 100, 100, 100, 100 ],
                    done
                );
            });

            it ("proceeds when .exists validates", function (done) {
                testTransform (
                    {
                        type:    'array',
                        append:  'true',
                        thereExists:  [
                            { type:'number', minimum:10, times:4 }
                        ]
                    },
                    [ 12, 13, 14 ],
                    [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ],
                    [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ],
                    done
                );
            });

            it ("rejects when .exists does not validate", function (done) {
                testTransformFailure (
                    {
                        type:    'array',
                        append:  'true',
                        thereExists:  [
                            { type:'number', minimum:12, times:4 }
                        ]
                    },
                    [ 12, 13, 14 ],
                    [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ],
                    done
                );
            });

            it ("retains only unique values with .unique", function (done) {
                testTransform (
                    { uniqueItems:true, append:true },
                    [ 0, 1, 2, 2, 1, 2, 5, 43, 6, 45, 12, 34 ,65, 4, 2, 3, 43, 2, 5, 7 ],
                    [ 0, 1, 32, 3, 8, 43, 0, 5, 7 ],
                    [ 0, 1, 3, 5, 7, 8, 32, 43, 2, 6, 45, 12, 34, 65, 4 ],
                    done
                );
            });

        });

        describe ("Strings", function(){

            it ("fails when transform exceeds max length", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:   { type:'string', maxLength:32 }
                        }
                    },
                    {    // source
                        able:   'This is my String. There are many like it, but this one is mine.'
                    },
                    {    // target
                        able:   'Hello, World!'
                    },
                    done
                );
            });

            it ("fails when transform does not reach min length", function (done) {
                testTransformFailure (
                    {
                        properties: {
                            able:   { type:'string', minLength:32 }
                        }
                    },
                    {    // source
                        able:   'Hello, World!'
                    },
                    {    // target
                        able:   'This is my String. There are many like it, but this one is mine.'
                    },
                    done
                );
            });

            it ("fails when transform violates exact length", function (done) {
                testTransformFailure (
                    {
                        properties: {
                            able:   { type:'string', length:13 }
                        }
                    },
                    {    // source
                        able:   'This is my String. There are many like it, but this one is mine.'
                    },
                    {    // target
                        able:   'Hello, World!'
                    },
                    done
                );
            });

        });

        describe ("Numbers", function(){

            it ("fails when transform is above max", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:   { type:'number', maximum:100 }
                        }
                    },
                    {    // source
                        able:   105
                    },
                    {    // target
                        able:   100
                    },
                    done
                );
            });

            it ("fails when transform is below min", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:   { type:'number', minimum:100 }
                        }
                    },
                    {    // source
                        able:   95
                    },
                    {    // target
                        able:   100
                    },
                    done
                );
            });

            it ("fails when transform is equal to exclusive max", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:   { type:'number', maximum:100, exclusiveMaximum:true }
                        }
                    },
                    {    // source
                        able:   100
                    },
                    {    // target
                        able:   95
                    },
                    done
                );
            });

            it ("fails when transform is equal to exclusive min", function (done) {
                testTransformFailure (
                    {    // schema
                        properties: {
                            able:   { type:'number', minimum:100, exclusiveMinimum:true }
                        }
                    },
                    {    // source
                        able:   100
                    },
                    {    // target
                        able:   105
                    },
                    done
                );
            });

        });

    });

    describe ("transforms", function(){

        describe ("Numbers", function(){

            describe (".cast", function(){

                it ("casts Strings to Numbers", function (done) {
                    testTransform (
                        {    // schema
                            properties: {
                                able:   { type:'number', cast:true }
                            }
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
                            properties: {
                                able:   { type:'number', cast:true }
                            }
                        },
                        {    // source
                            able:   '9001.781a'
                        },
                        { },
                        done
                    );
                });

            });

            describe ("normalization", function(){

                it ("normalizes Numbers", function (done) {
                    testTransform (
                        {    // schema
                            properties: {
                                able:   5,
                                baker:  { type:'number', normalize:10 }
                            }
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
                            properties: {
                                able:   { type:'number', add:true },
                                baker:  { type:'number', add:true }
                            }
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
                            properties: {
                                able:   { type:'number', add:true },
                            }
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
                            properties: {
                                able:   { type:'number', subtract:true },
                                baker:  { type:'number', subtract:true }
                            }
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
                            properties: {
                                able:   { type:'number', subtract:true }
                            }
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
                            properties: {
                                able:   { type:'number', multiply:true },
                                baker:  { type:'number', multiply:true }
                            }
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
                            properties: {
                                able:   { type:'number', multiply:true }
                            }
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
                            properties: {
                                able:   { type:'number', divide:true },
                                baker:  { type:'number', divide:true }
                            }
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
                            properties: {
                                able:   { type:'number', divide:true }
                            }
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

                it ("averages target with input", function (done) {
                    testTransform (
                        {    // schema
                            properties: {
                                able:   { type:'number', average:true },
                                baker:  { type:'number', average:true }
                            }
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
                        },
                        done
                    );
                });

                it ("averages missing target with input", function (done) {
                    testTransform (
                        {    // schema
                            properties: {
                                able:   { type:'number', average:true }
                            }
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

            });

            it ("filters by modulo", function (done) {
                testTransform (
                    {    // schema
                        properties: {
                            able:   { type:'number', modulate:4 },
                            baker:  { type:'number', modulate:7 }
                        }
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
                        properties: {
                            able:   { type:'number', invert:true },
                            baker:  { type:'number', invert:true }
                        }
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
                        properties: {
                            able:   { type:'number', reciprocal:true },
                            baker:  { type:'number', reciprocal:true }
                        }
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

                it ("completes when post-transform Numbers are within bounds", function (done) {
                    testTransform (
                        {    // schema
                            properties: {
                                able:       { type:'number', maximum:100, add:true },
                                baker:      { type:'number', minimum:2, subtract:true },
                                charlie:    { type:'number', maximum:100, multiply:true },
                                dog:        { type:'number', minimum:0, divide:true },
                                easy:       { type:'number', maximum:7, modulate:7 },
                                fox:        { type:'number', maximum:0, invert:true },
                                george:     { type:'number', maximum:1/5, reciprocal:true }
                            }
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
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties: {
                                        able:       { type:'number', maximum:10, add:true },
                                        baker:      { type:'number', minimum:2, subtract:true },
                                        charlie:    { type:'number', maximum:100, multiply:true },
                                        dog:        { type:'number', minimum:0, divide:true },
                                        easy:       { type:'number', maximum:7, modulate:7 },
                                        fox:        { type:'number', maximum:0, invert:true },
                                        george:     { type:'number', maximum:1/5, reciprocal:true }
                                    }
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
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties: {
                                        able:       { type:'number', maximum:100, add:true },
                                        baker:      { type:'number', minimum:10, subtract:true },
                                        charlie:    { type:'number', maximum:100, multiply:true },
                                        dog:        { type:'number', minimum:0, divide:true },
                                        easy:       { type:'number', maximum:7, modulate:7 },
                                        fox:        { type:'number', maximum:0, invert:true },
                                        george:     { type:'number', maximum:1/5, reciprocal:true }
                                    }
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
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties: {
                                        able:       { type:'number', maximum:100, add:true },
                                        baker:      { type:'number', minimum:3, subtract:true },
                                        charlie:    { type:'number', maximum:8, multiply:true },
                                        dog:        { type:'number', minimum:0, divide:true },
                                        easy:       { type:'number', maximum:7, modulate:7 },
                                        fox:        { type:'number', maximum:0, invert:true },
                                        george:     { type:'number', maximum:1/5, reciprocal:true }
                                    }
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
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties: {
                                        able:       { type:'number', maximum:100, add:true },
                                        baker:      { type:'number', minimum:3, subtract:true },
                                        charlie:    { type:'number', maximum:100, multiply:true },
                                        dog:        { type:'number', minimum:10, divide:true },
                                        easy:       { type:'number', maximum:7, modulate:7 },
                                        fox:        { type:'number', maximum:0, invert:true },
                                        george:     { type:'number', maximum:1/5, reciprocal:true }
                                    }
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
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties: {
                                        able:       { type:'number', maximum:100, add:true },
                                        baker:      { type:'number', minimum:3, subtract:true },
                                        charlie:    { type:'number', maximum:100, multiply:true },
                                        dog:        { type:'number', minimum:0, divide:true },
                                        easy:       { type:'number', maximum:6, modulate:10 },
                                        fox:        { type:'number', maximum:0, invert:true },
                                        george:     { type:'number', maximum:1/5, reciprocal:true }
                                    }
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
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties: {
                                        able:       { type:'number', maximum:100, add:true },
                                        baker:      { type:'number', minimum:3, subtract:true },
                                        charlie:    { type:'number', maximum:100, multiply:true },
                                        dog:        { type:'number', minimum:0, divide:true },
                                        easy:       { type:'number', maximum:7, modulate:7 },
                                        fox:        { type:'number', minimum:0, invert:true },
                                        george:     { type:'number', maximum:1/5, reciprocal:true }
                                    }
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
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties: {
                                        able:       { type:'number', maximum:100, add:true },
                                        baker:      { type:'number', minimum:3, subtract:true },
                                        charlie:    { type:'number', maximum:100, multiply:true },
                                        dog:        { type:'number', minimum:0, divide:true },
                                        easy:       { type:'number', maximum:7, modulate:7 },
                                        fox:        { type:'number', maximum:0, invert:true },
                                        george:     { type:'number', maximum:0, reciprocal:true }
                                    }
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
                                callback
                            );
                        }
                    ], done);
                });

            });

        });

        describe ("Strings", function(){

            describe (".inject", function(){

                it ("injects a String into the input", function (done) {
                    testTransform (
                        {    // schema
                            properties: {
                                able:  { type:'string', inject:[ [ 10, 'INTERRUPTING COW' ] ] }
                            }
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
                            properties: {
                                able:  { type:'string', inject:[ [ null, 'TRAILING COW'] ] },
                                baker: { type:'string', inject:[ [ 'TRAILING COW'] ] }
                            }
                        },
                        {    // source
                            able:       'test',
                            baker:      'test'
                        },
                        { }, // target
                        {    // goal
                            able:       'testTRAILING COW',
                            baker:      'testTRAILING COW'
                        },
                        done
                    );
                });

            });

            describe (".insert", function(){

                it ("inserts the input into the target", function (done) {
                    testTransform (
                        {    // schema
                            properties:{ able:{ type:'string', insert:10 } }
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
                            properties:{ able:{ type:'string', insert:10 } }
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
                            properties:{ able:{ type:'string', append:true } }
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
                            properties:{ able:{ type:'string', append:true } }
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
                            properties:{ able:{ type:'string', prepend:true } }
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
                            properties:{ able:{ type:'string', prepend:true } }
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

                it ("uppercase converts the input", function(){
                    testTransform (
                        {    // schema
                            able:  { type:'string', case:'upper' }
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
                            able:  { type:'string', case:'lower' }
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

            describe ("post-transform limits", function(){

                it ("proceeds when post-transform String is within bounds", function (done) {
                    testTransform (
                        {    // schema
                            properties:{ able: {
                                type:       'string',
                                inject:     [ [ 1, 'foo' ]],
                                prepend:    true,
                                maxLength:  20
                            } }
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
                    async.parallel ([
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties:{ able: {
                                        type:       'string',
                                        inject:     [ [ 1, 'foo' ]],
                                        prepend:    true,
                                        maxLength:  15
                                    } }
                                },
                                {    // source
                                    able:   'cheese'
                                },
                                {    // target
                                    able:   ' factory'
                                },
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties:{ able: {
                                        type:       'string',
                                        inject:     [ [ 1, 'foo' ]],
                                        prepend:    true,
                                        minLength:  100
                                    } }
                                },
                                {    // source
                                    able:   'cheese'
                                },
                                {    // target
                                    able:   ' factory'
                                },
                                callback
                            );
                        }
                    ], done);
                });

            });

            describe ("post-transform .regex match", function(){

                it ("proceeds when post-transform String matches a regex filter", function (done) {
                    testTransform (
                        {    // schema
                            properties:{ able:{
                                type:       'string',
                                inject:     [ [ 1, 'foo' ]],
                                prepend:    true,
                                match:      '^[a-zA-Z ]+$'
                            } }
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
                            properties:{ able:{
                                type:       'string',
                                inject:     [ [ 1, 'f00' ]],
                                prepend:    true,
                                match:      '^[a-zA-Z ]+$'
                            } }
                        },
                        {    // source
                            able:   'cheese'
                        },
                        {    // target
                            able:   ' factory'
                        },
                        done
                    );
                });

            });

        });

        describe ("Booleans", function(){

            describe ("cast", function(){

                it ("casts Strings to Booleans", function (done) {
                    async.parallel ([
                        function (callback) {
                            testTransform (
                                {    // schema
                                    properties:{ able:{ type:'boolean', cast:true } },
                                },
                                {    // source
                                    able:   'true'
                                },
                                { }, // target
                                {    // goal
                                    able:   true
                                },
                                callback
                            );
                        },
                        function (callback) {
                            testTransform (
                                {    // schema
                                    properties:{ able:{ type:'boolean', cast:true } },
                                },
                                {    // source
                                    able:   'False'
                                },
                                { }, // target
                                {    // goal
                                    able:   false
                                },
                                callback
                            );
                        },
                        function (callback) {
                            testTransform (
                                {    // schema
                                    properties:{ able:{ type:'boolean', cast:true } },
                                },
                                {    // source
                                    able:   'TRUE'
                                },
                                { }, // target
                                {    // goal
                                    able:   true
                                },
                                callback
                            );
                        }
                    ], done);
                });

                it ("completes when cast encounters a Boolean", function (done) {
                    testTransform (
                        { properties:{ able:{ type:'boolean', cast:true } } },
                        { able:true },
                        { },
                        { able:true },
                        done
                    );
                });

                it ("rejects invalid Boolean Strings", function (done) {
                    testTransformFailure (
                        {    // schema
                            properties:{ able:{ type:'boolean', cast:true } },
                        },
                        {    // source
                            able:   'truth'
                        },
                        { },
                        done
                    );
                });

            });

            describe ("invert", function(){

                it ("inverts booleans", function(){
                    testTransform (
                        { properties:{ able:{ type:'boolean', invert:true } } },
                        { able:true },
                        {},
                        { able:false }
                    );
                });

            });

        });

        describe ("Objects", function(){

            describe (".cast", function(){

                it ("casts JSON Strings to Objects", function (done) {
                    testTransform (
                        {    // schema
                            properties: {
                                able:   {
                                    type:       'object',
                                    cast:       true,
                                    properties: {
                                        able:       { type:'string' },
                                        baker:      {
                                            properties: {
                                                able:       { type:'number' }
                                            },
                                            required:[ 'able' ]
                                        }
                                    },
                                    required:[ 'able', 'baker' ]
                                }
                            },
                            required:[ 'able' ]
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
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties:{ able:{ type:'object', cast:true } }
                                },
                                {    // source
                                    able:   '{ "able":"foo", "baker":{ able:9001 }}'
                                },
                                { },
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties:{ able:{ type:'object', cast:true } }
                                },
                                {    // source
                                    able:   '[ 0, 1, 2, { able:"foo" } ]'
                                },
                                { },
                                callback
                            );
                        }
                    ], done);
                });

            });

            describe (".inject", function(){

                it ("injects keys into the input", function (done) {
                    testTransform (
                        {    // schema
                            type:   'object',
                            inject: [
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

            describe (".rename", function(){

                it ("renames keys", function (done) {
                    testTransform (
                        {    // schema
                            rename:     {
                                able:       'baker'
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
                    async.parallel ([
                        function (callback) {
                            testTransform (
                                {    // schema
                                    rename:     {
                                        able:       'baker'
                                    }
                                },
                                {    // source
                                    baker:  'nine thousand and one',
                                    able:   9001
                                },
                                { }, // target
                                {    // goal
                                    baker:  9001
                                },
                                callback
                            );
                        },
                        function (callback) {
                            testTransform (
                                {    // schema
                                    rename:     {
                                        able:       'baker'
                                    }
                                },
                                {    // source
                                    able:   9001,
                                    baker:  'nine thousand and one'
                                },
                                { }, // target
                                {    // goal
                                    baker:  'nine thousand and one'
                                },
                                callback
                            );
                        }
                    ], done);
                });

                it ("processes keys with their new names", function (done) {
                    testTransform (
                        {    // schema
                            type:       'object',
                            rename:     {
                                able:       'baker'
                            },
                            properties: {
                                able:       { type:'string' },
                                baker:      { type:'number' }
                            },
                            required:   [ 'baker' ]
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
                    async.parallel ([
                        function (callback) {
                            testTransform (
                                {    // schema
                                    type:       'object',
                                    drop:       [ 'baker' ]
                                },
                                {    // source
                                    able:   9001,
                                    baker:  'nine thousand and one'
                                },
                                { }, // target
                                {    // goal
                                    able:   9001
                                },
                                callback
                            );
                        },
                        function (callback) {
                            testTransform (
                                {    // schema
                                    type:       'object',
                                    drop:       [ 'baker' ]
                                },
                                {    // source
                                    able:   9001,
                                    baker:  'nine thousand and one'
                                },
                                { able:9, baker:'foo bar baz' }, // target
                                { able:9001, baker:'foo bar baz' },
                                callback
                            );
                        }
                    ], done);
                });

            });

            describe (".clip", function(){

                it ("keeps only the newest keys from the target document", function (done) {
                    testTransform (
                        {    // schema
                            type:       'object',
                            clip:       3
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
                            type:       'object',
                            clip:       -3
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
                            type:           'object',
                            maxProperties:  4,
                            inject:         [
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
                            properties:{ able:{ type:'array', cast:true } }
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
                                    properties:{ able:{ type:'array', cast:true } }
                                },
                                {    // source
                                    able:   '[ 0, 1, 2, { able:"foo" } ]'
                                },
                                { },
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    properties:{ able:{ type:'array', cast:true } }
                                },
                                {    // source
                                    able:   '{ "able":"foo", "baker":{ "able:9001" }}'
                                },
                                { },
                                callback
                            );
                        }
                    ], done);
                });

            });

            describe (".sort", function(){

                it ("appends to the correct position when using a simple .sort", function (done) {
                    testTransform (
                        { sort:1, append:true },
                        [ 4, 7, 8, 20, 2 ],
                        [ 9, 11, 6 ],
                        [ 2, 4, 6, 7, 8, 9, 11, 20 ],
                        done
                    );
                });

                it ("prepends to the correct position when using a simple .sort", function (done) {
                    testTransform (
                        { sort:1, prepend:true },
                        [ 4, 7, 8, 20, 2 ],
                        [ 9, 11, 6 ],
                        [ 2, 4, 6, 7, 8, 9, 11, 20 ],
                        done
                    );
                });

                it ("inserts to the correct position when using a simple .sort", function (done) {
                    testTransform (
                        { sort:1, insert:3 },
                        [ 4, 7, 8, 20, 2 ],
                        [ 9, 11, 6 ],
                        [ 2, 4, 6, 7, 8, 9, 11, 20 ],
                        done
                    );
                });

                it ("appends to the correct position when using a complex .sort", function (done) {
                    testTransform (
                        { sort:{ able:1 }, append:true },
                        [ { able:4 }, { able:7 }, { able:8 }, { able:20 }, { able:2 } ],
                        [ { able:9 }, { able:11 }, { able:6 } ],
                        [
                            { able:2 }, { able:4 }, { able:6  }, { able:7  },
                            { able:8 }, { able:9 }, { able:11 }, { able:20 }
                        ],
                        done
                    );
                });

                it ("prepends to the correct position when using a complex .sort", function (done) {
                    testTransform (
                        { sort:{ able:1 }, prepend:true },
                        [ { able:4 }, { able:7 }, { able:8 }, { able:20 }, { able:2 } ],
                        [ { able:9 }, { able:11 }, { able:6 } ],
                        [
                            { able:2 }, { able:4 }, { able:6  }, { able:7  },
                            { able:8 }, { able:9 }, { able:11 }, { able:20 }
                        ],
                        done
                    );
                });

                it ("inserts to the correct position when using a complex .sort", function (done) {
                    testTransform (
                        { sort:{ able:1 }, insert:3 },
                        [ { able:4 }, { able:7 }, { able:8 }, { able:20 }, { able:2 } ],
                        [ { able:9 }, { able:11 }, { able:6 } ],
                        [
                            { able:2 }, { able:4 }, { able:6  }, { able:7  },
                            { able:8 }, { able:9 }, { able:11 }, { able:20 }
                        ],
                        done
                    );
                });

                it ("pre-sorts the input value when using simple .sort and .sequence", function (done) {
                    testTransform (
                        { sort:1, items:[ { add:true }, { multiply:true } ] },
                        [ 20, 10 ],
                        [ 10, 20 ],
                        [ 20, 400 ],
                        done
                    );
                });

                it ("pre-sorts the input value when using complex .sort and .sequence", function (done) {
                    testTransform (
                        { sort:1, items:[
                            { properties:{ able:{ add:true } } },
                            { properties:{ able:{ multiply:true } } }
                        ] },
                        [ { able:20 }, { able:10 } ],
                        [ { able:10 }, { able:20 } ],
                        [ { able:20 }, { able:400 } ],
                        done
                    );
                });

            });

            describe (".inject", function(){

                it ("adds values to the input", function (done) {
                    testTransform (
                        {    // schema
                            properties:{ able:{
                                type:   'array',
                                inject: [
                                    [ 9001 ],
                                    [ undefined, 9001 ],
                                    [ null, 9001 ],
                                    [ NaN, 9001 ]
                                ]
                            } }
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
                            properties:{ able:{
                                type:   'array',
                                inject: [
                                    [ 5, 9001 ],
                                    [ 3, 9001 ],
                                    [ 1, 9001 ]
                                ]
                            } }
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
                            properties:{ able:{
                                type:   'array',
                                inject: [
                                    [ 1, 9001 ],
                                    [ 3, 9001 ],
                                    [ 5, 9001 ]
                                ]
                            } }
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
                            type:   'array',
                            insert: 3
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
                            type:   'array',
                            insert: 3
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
                            properties:{ able:{    // schema
                                type:   'array',
                                insert: 3
                            } }
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
                            type:   'array',
                            insert: 3,
                            inject: [
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

                it ("inserts only novel values with .unique", function (done) {
                    testTransform (
                        { insert:3, uniqueItems:true },
                        [ 1, 2, 3, 4, 5, 6 ],
                        [ 1, 3, 5, 7 ],
                        [ 1, 3, 5, 2, 4, 6, 7 ],
                        done
                    );
                });

            });

            describe (".append", function(){

                it ("appends input values to the target", function (done) {
                    testTransform (
                        {    // schema
                            type:   'array',
                            append: true
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
                            type:   'array',
                            append: true,
                            inject: [
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

                it ("appends only novel values with .unique", function (done) {
                    testTransform (
                        { append:true, uniqueItems:true },
                        [ 1, 2, 3, 4, 5, 6 ],
                        [ 1, 3, 5, 7 ],
                        [ 1, 3, 5, 7, 2, 4, 6 ],
                        done
                    );
                });

            });

            describe (".prepend", function(){

                it ("prepends input values to the target", function (done) {
                    testTransform (
                        {    // schema
                            type:    'array',
                            prepend: true
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
                            type:    'array',
                            prepend: true,
                            inject:  [
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

                it ("prepends only novel values with .unique", function (done) {
                    testTransform (
                        { prepend:true, uniqueItems:true },
                        [ 1, 2, 3, 4, 5, 6 ],
                        [ 1, 3, 5, 7 ],
                        [ 2, 4, 6, 1, 3, 5, 7 ],
                        done
                    );
                });

            });

            describe ("clip", function(){

                it ("keeps only the last elements of the target", function (done) {
                    async.parallel ([
                        function (callback) {
                            testTransform (
                                {    // schema
                                    type:   'array',
                                    clip:   -4
                                },
                                [    // source
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                [ ], // target
                                [    // goal
                                    6, 7, 8, 9
                                ],
                                callback
                            );
                        },
                        function (callback) {
                            testTransform (
                                {    // schema
                                    type:   'array',
                                    clip:   -4,
                                    prepend: true
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
                                callback
                            );
                        }
                    ], done)
                });

                it ("keeps only the first elements of the target", function (done) {
                    async.parallel ([
                        function (callback) {
                            testTransform (
                                {    // schema
                                    type:   'array',
                                    clip:   4
                                },
                                [    // source
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                [ ], // target
                                [    // goal
                                    0, 1, 2, 3
                                ],
                                callback
                            );
                        },
                        function (callback) {
                            testTransform (
                                {    // schema
                                    type:    'array',
                                    clip:    4,
                                    append: true
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
                                callback
                            );
                        }
                    ], done);
                });

            });

            describe ("post-transform limits", function(){

                it ("rejects element counts not within bounds after transform", function (done) {
                    async.parallel ([
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    type:    'array',
                                    append:  true,
                                    maxItems: 15
                                },
                                [    // source
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                [    // target
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    type:    'array',
                                    prepend: true,
                                    maxItems: 15
                                },
                                [    // source
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                [    // target
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    type:    'array',
                                    insert:  5,
                                    maxItems: 15
                                },
                                [    // source
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                [    // target
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                callback
                            );
                        },
                        function (callback) {
                            testTransformFailure (
                                {    // schema
                                    type:    'array',
                                    inject:  [
                                        [ 1, 9 ],
                                        [ 3, 9 ],
                                        [ 5, 9 ]
                                    ],
                                    maxItems: 11
                                },
                                [    // source
                                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
                                ],
                                [ ],
                                callback
                            );
                        }
                    ], done);
                });

            });

        });

    });

    describe ("polyschemata", function(){

        it ("always fails to transform with mismatched source and target types", function (done) {
            async.parallel ([
                function (callback) {
                    testTransformFailure (
                        { anyOf:[
                            { type:'string', match:'^\\w+$', append:true },
                            { type:'array', all:{ type:'string', match:'^\\w+$' }, prepend:true }
                        ] },
                        [ 'foo' ],
                        'bar',
                        callback
                    );
                },
                function (callback) {
                    testTransformFailure (
                        { ondOf:[
                            { type:'string', match:'^\\w+$', append:true },
                            { type:'array', all:{ type:'string', match:'^\\w+$' }, prepend:true }
                        ] },
                        [ 'foo' ],
                        'bar',
                        callback
                    );
                }
            ], done);
        });

        describe ("anyOf", function(){

            it ("transforms with one of several schemata", function (done) {
                async.parallel ([
                    function (callback) {
                        testTransform (
                            { anyOf:[
                                { type:'string', match:'^\\w+$', append:true },
                                { type:'array', forAll:{ type:'string', match:'^\\w+$' }, prepend:true },
                                { type:'string', match:'^\\w+$', prepend:true },
                                { type:'array', forAll:{ type:'string', match:'^\\w+$' }, prepend:true }
                            ] },
                            [ 'foo', 'bar' ],
                            [ 'baz' ],
                            [ 'foo', 'bar', 'baz' ],
                            callback
                        );
                        // callback();
                    },
                    function (callback) {
                        testTransform (
                            { anyOf:[
                                { type:'string', match:'^\\w+$', append:true },
                                { type:'array', forAll:{ type:'string', match:'^\\w+$' }, prepend:true },
                                { type:'string', match:'^\\w+$', prepend:true },
                                { type:'array', forAll:{ type:'string', match:'^\\w+$' }, prepend:true }
                            ] },
                            'baz',
                            'foobar',
                            'foobarbaz',
                            callback
                        );
                    }
                ], done);
            });

            it ("fails to match any of several schemata", function (done) {
                testTransformFailure (
                    { anyOf:[
                        { type:'string', match:'^\\w+$', append:true },
                        { type:'array', forAll:{ type:'string', match:'^\\w+$' }, prepend:true },
                        { type:'string', match:'^\\w+$', prepend:true },
                        { type:'array', forAll:{ type:'string', match:'^\\w+$' }, prepend:true }
                    ] },
                    'foo bar',
                    'baz',
                    done
                );
            });

        });

        describe ("oneOf", function(){

            it ("transforms with one of several schemata", function (done) {
                async.parallel ([
                    function (callback) {
                        testTransform (
                            { oneOf:[
                                { type:'string', match:'^\\w+$', append:true },
                                { type:'array', all:{ type:'string', match:'^\\w+$' }, prepend:true }
                            ] },
                            [ 'foo', 'bar' ],
                            [ 'baz' ],
                            [ 'foo', 'bar', 'baz' ],
                            callback
                        );
                    },
                    function (callback) {
                        testTransform (
                            { oneOf:[
                                { type:'string', match:'^\\w+$', append:true },
                                { type:'array', all:{ type:'string', match:'^\\w+$' }, prepend:true }
                            ] },
                            'baz',
                            'foobar',
                            'foobarbaz',
                            callback
                        );
                    }
                ], done);
            });

            it ("fails to transform with any of several schemata", function (done) {
                testTransformFailure (
                    { oneOf:[
                        { type:'string', match:'^\\w+$', append:true },
                        { type:'array', all:{ type:'string', match:'^\\w+$' }, prepend:true }
                    ] },
                    'foo bar',
                    'baz',
                    done
                );
            });

            it ("fails to transform due to too many passing schema", function (done) {
                testTransformFailure (
                    { oneOf:[
                        { type:'string', match:'^\\w+$', append:true },
                        { type:'array', all:{ type:'string', match:'^\\w+$' }, prepend:true },
                        { type:'array', all:{ type:'string', match:'^\\w+$' }, prepend:true }
                    ] },
                    [ 'foo', 'bar' ],
                    [ 'baz' ],
                    done
                );
            });

        });

        describe ("not", function(){

            it ("transform when the inverse schema fails to validate after transform", function (done) {
                async.parallel ([
                    function (callback) {
                        testTransform (
                            { type:"string", not:{ match:'^\\w+$' }, append:true },
                            "foo bar",
                            "baz",
                            "bazfoo bar",
                            callback
                        );
                    },
                    function (callback) {
                        testTransform (
                            { type:"string", not:{ match:'^\\w+$' }, append:true },
                            "baz",
                            "foo bar",
                            "foo barbaz",
                            callback
                        );
                    }
                ], done);
            });

            it ("fails to transform when the inverse schema validates after transform", function (done) {
                testTransformFailure (
                    { type:"string", not:{ match:'^\\w+$' }, append:true, clip:6 },
                    "foo bar",
                    "baz",
                    done
                );
            });

        });

    });

    describe ("accumulators", function(){

        it ("processes a complex .fill", function (done) {

            testTransform (
                { properties:{
                    expenses:   {
                        type:           'array',
                        forAll:         { properties:{
                            amount:         { type:'number', minimum:0 },
                            type:           { type:'string', maximum:128 },
                            description:    { type:'string', optional:true },
                            time:           { type:'string', format:'date-time' }
                        } },
                        append:         true
                    },
                    income:         { properties:{
                        paycheques:     {
                            type:        'array',
                            forAll:      { properties:{
                                amount:         { type:'number', minimum:0 },
                                description:    { type:'string', optional:true },
                                time:           { type:'string', format:'date-time' }
                            } },
                            append:      true
                        },
                        other:          {
                            type:        'array',
                            forAll:      { properties:{
                                amount:         { type:'number', minimum:0 },
                                type:           { type:'string', maximum:128 },
                                description:    { type:'string' },
                                time:           { type:'string', format:'date-time' }
                            } },
                            append:      true
                        },
                    } },
                    monthly:        {
                        default:     {},
                        properties:     {
                            income:         {
                                fill:        {
                                    fill:        [
                                        'income/paycheques/amount',
                                        'income/other/amount'
                                    ],
                                    type:        'number',
                                    add:         true
                                },
                                average:     5
                            },
                            expenses:       {
                                fill:        {
                                    fill:        'expenses/amount',
                                    type:        'number',
                                    add:         true
                                },
                                average:     5
                            }
                        }
                    }
                } },
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
                },
                done
            );
        });

        it ("processes a complex .list", function (done) {

            testTransform (
                { properties:{
                    dataPoints: {
                        type:    'array',
                        forAll:  { properties:{
                            x:          { type:'number', gte:0 },
                            y:          { type:'number', gte:0 }
                        } },
                        sort:    { x:1 },
                        append:  true
                    },
                    average:   {
                        default:   {},
                        properties: {
                            x:         {
                                type:       'number',
                                list:       'dataPoints/x',
                                mean:       true
                            },
                            y:          {
                                type:       'number',
                                list:       'dataPoints/y',
                                mean:       true
                            }
                        }
                    },
                } },
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
                },
                done
            );

        });

        it ("creates filled Objects", function (done) {

            testTransform (
                { properties: {
                    val:       { properties:{
                        able:       { type:'number' },
                        baker:      { type:'number' }
                    } },
                    generated:  {
                        fill:        'val', properties:{
                        able:       { type:'number' },
                        baker:      { type:'number' }
                    } }
                } },
                {
                    val:   { able:0, baker:9 }
                },
                undefined,
                {
                    val:   { able:0, baker:9 },
                    generated: { able:0, baker:9 }
                },
                done
            );

        });

        it ("processes groups of values with .group and .groupTransform", function (done) {
            testTransform (
                {
                    properties: {
                        able:       {
                            type:    'array',
                            all:     {
                                able:       { type:'number' },
                                baker:      { type:'number' }
                            },
                            append:  true
                        },
                        baker:      {
                            type:        'number',
                            mean:        true,
                            fill:        {
                                fill:        'able',
                                group:       {
                                    fill:        'able',
                                    getMonth:    true
                                },
                                groupTransform:{
                                    fill:        'baker',
                                    add:         true
                                }
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
                },
                done
            );
        });

        it ("constrains with filter", function (done) {
            testTransform (
                {
                    tolerant:    true,
                    properties:     {
                        foo:            {
                            list:        'able/able/able',
                            filter:      { minimum:10 }
                        },
                        bar:            {
                            fill:        'able/able',
                            append:      true,
                            filter:      { properties:{ able:{ minimum:10 } } }
                        }
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
                },
                done
            );
        });

    });

});
