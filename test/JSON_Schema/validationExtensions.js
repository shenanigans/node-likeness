
var async = require ('async');
var likeness = require ('../../likeness');

function testValidate (document, schema, isValid, callback) {
    schema.$schema = 'http://json-schema.org/likeness';

    var context = new likeness.helpers.JSContext();
    context.compile ('https://foo.bar.com/test-schema', schema, function (err, compiled, metaschema) {
        if (err) return callback (err);
        likeness.helpers.fromJSONSchema (metaschema, compiled, function (err, likeDoc) {
            if (err) return callback (err);

            var likeInstance = new likeness (likeDoc);
            try {
                likeInstance.validate (document);
                if (!isValid)
                    return process.nextTick (function(){
                        callback (new Error ('failed to reject the document (sync)'));
                    });
            } catch (err) {
                if (isValid)
                    return callback (new Error ('failed to pass the document (sync)'));
            }

            try {
                var alive = true;
                return likeInstance.validate (document, function (err) {
                    if (err) {
                        if (isValid)
                            return callback (new Error ('failed to pass the document (async)'));
                    } else if (!isValid)
                        return callback (new Error ('failed to reject the document (async)'));

                    // final pass
                    callback();
                });
            } catch (err) {
                return callback (new Error ('async validation synchronously threw an Error'));
            }
        });
    });
}

describe ("validate (likeness extensions)", function(){

    describe ("Objects", function(){

        it ("accepts the document with `keyFormat`", function (done) {
            testValidate (
                {
                    'very.common@example.com':                          9001,
                    'a.little.lengthy.but.fine@dept.example.com':       9002,
                    'disposable.style.email.with+symbol@example.com':   9003
                },
                {
                    keyFormat:'email'
                },
                true,
                done
            );
        });

        it ("rejects the document with `keyFormat`", function (done) {
            testValidate (
                {
                    'very.common@example.com':                          9001,
                    'badmail':                                          9002,
                    'disposable.style.email.with+symbol@example.com':   9003
                },
                {
                    keyFormat:'email'
                },
                false,
                done
            );
        });

        it ("requires properties to be unique", function (done) {
            async.parallel ([
                function (callback) {
                    testValidate (
                        { able:1, baker:'1', charlie:{ able:1 }, dog:{ able:'1' } },
                        { uniqueProperties:true },
                        true,
                        callback
                    );
                },
                function (callback) {
                    testValidate (
                        { able:1, baker:'1', charlie:{ able:1 }, dog:{ able:'1' }, easy:{ able:'1' } },
                        { uniqueProperties:true },
                        false,
                        callback
                    );
                }
            ], done);
        });

        it ("applies a global schema to every property with `forAll`", function (done) {
            async.parallel ([
                function (callback) {
                    testValidate (
                        { able:11, baker:12, charlie:13, dog:14, easy:15 },
                        {
                            properties:{ charlie:{ minimum:12, maximum:14 } },
                            forAll:{ type:'number', minimum:10 }
                        },
                        true,
                        callback
                    );
                },
                function (callback) {
                    testValidate (
                        { able:11, baker:12, charlie:13, dog:'14', easy:15 },
                        {
                            properties:{ charlie:{ minimum:12, maximum:14 } },
                            forAll:{ type:'number', minimum:10 }
                        },
                        false,
                        callback
                    );
                }
            ], done);
        });

        it ("requires one property to match each of several schemata with `thereExists`", function (done) {
            async.parallel ([
                function (callback) {
                    testValidate (
                        { able:10, baker:20, charlie:30, dog:40, easy:50, fox:60, george:70 },
                        {
                            thereExists: [
                                { minimum:40 },
                                { multipleOf:50 },
                                { maximum:40 }
                            ]
                        },
                        true,
                        callback
                    );
                },
                function (callback) {
                    testValidate (
                        { able:10, baker:20, charlie:30, dog:40, easy:50, fox:60, george:70 },
                        {
                            thereExists:    [
                                { minimum:40 },
                                { multipleOf:55 },
                                { maximum:40 }
                            ]
                        },
                        false,
                        callback
                    );
                }
            ], done);
        });

        it ("requires several properties to match several schemata with `thereExists` and `times`", function (done) {
            async.parallel ([
                function (callback) {
                    testValidate (
                        { able:10, baker:20, charlie:30, dog:40, easy:50, fox:60, george:70 },
                        {
                            thereExists: [
                                { minimum:40, times:4 },
                                { multipleOf:50, times:1 },
                                { maximum:40, times:4 },
                                { multipleOf:30, times:2 }
                            ]
                        },
                        true,
                        callback
                    );
                },
                function (callback) {
                    testValidate (
                        { able:10, baker:20, charlie:30, dog:40, easy:50, fox:60, george:70 },
                        {
                            thereExists:    [
                                { minimum:40, times:4 },
                                { multipleOf:50, times:1 },
                                { maximum:40, times:5 },
                                { multipleOf:30, times:2 }
                            ]
                        },
                        false,
                        callback
                    );
                }
            ], done);
        });

    });

    describe ("Arrays", function(){

        it ("parallels a global `forAll` for every item and an `items` sequence for each item", function (done) {
            async.parallel ([
                function (callback) {
                    testValidate (
                        { able:[ 10, 20, 30, 40, 50, 60, 70 ] },
                        { properties:{ able:{
                            forAll:{ type:'number' },
                            items:[
                                { minimum:5,  maximum:15 },
                                { minimum:15, maximum:25 },
                                { minimum:25, maximum:35 },
                                { minimum:35, maximum:45 },
                                { minimum:45, maximum:55 },
                                { minimum:55, maximum:65 },
                                { minimum:65, maximum:75 }
                            ]
                        } } },
                        true,
                        callback
                    );
                },
                function (callback) {
                    testValidate (
                        { able:[ 10, 20, 30, 40, '50', 60, 70 ] },
                        { properties:{ able:{
                            forAll:{ type:'number' },
                            items:[
                                { minimum:5,  maximum:15 },
                                { minimum:15, maximum:25 },
                                { minimum:25, maximum:35 },
                                { minimum:35, maximum:45 },
                                {  }, // ONLY forAll should invalidate this item
                                { minimum:55, maximum:65 },
                                { minimum:65, maximum:75 }
                            ]
                        } } },
                        false,
                        callback
                    );
                },
                function (callback) {
                    testValidate (
                        { able:[ 10, 20, 30, 40, 50, 60, 70 ] },
                        { properties:{ able:{
                            forAll:{ type:'number' },
                            items:[
                                { minimum:5,  maximum:15 },
                                { minimum:15, maximum:25 },
                                { minimum:25, maximum:35 },
                                { minimum:35, maximum:45 },
                                { minimum:45, maximum:55 },
                                { minimum:55, maximum:59 },
                                { minimum:65, maximum:75 }
                            ]
                        } } },
                        false,
                        callback
                    );
                }
            ], done);
        });

        it ("requires one item to match each of several schemata with `thereExists`", function (done) {
            async.parallel ([
                function (callback) {
                    testValidate (
                        { able:[ 10, 20, 30, 40, 50, 60, 70 ] },
                        { properties:{ able:{ thereExists:[
                            { minimum:40 },
                            { multipleOf:50 },
                            { maximum:40 },
                            { multipleOf:30 }
                        ] } } },
                        true,
                        callback
                    );
                },
                function (callback) {
                    testValidate (
                        { able:[ 10, 20, 30, 40, 50, 60, 70 ] },
                        { properties:{ able:{ thereExists:[
                            { minimum:40 },
                            { multipleOf:55 },
                            { maximum:40 },
                            { multipleOf:30 }
                        ] } } },
                        false,
                        callback
                    );
                }
            ], done);
        });

        it ("requires several items to match several schemata with `thereExists` and `times`", function (done) {
            async.parallel ([
                function (callback) {
                    testValidate (
                        { able:[ 10, 20, 30, 40, 50, 60, 70 ] },
                        { properties:{ able:{ thereExists:[
                            { minimum:40, times:4 },
                            { multipleOf:50, times:1 },
                            { maximum:40, times:4 },
                            { multipleOf:30, times:2 }
                        ] } } },
                        true,
                        callback
                    );
                },
                function (callback) {
                    testValidate (
                        { able:[ 10, 20, 30, 40, 50, 60, 70 ] },
                        { properties:{ able:{ thereExists:[
                            { minimum:40, times:4 },
                            { multipleOf:50, times:1 },
                            { maximum:40, times:5 },
                            { multipleOf:30, times:2 }
                        ] } } },
                        false,
                        callback
                    );
                }
            ], done);
        });

    });

});
