
var Likeness = require ('../../Likeness');
var assert = require ('assert');
var async = require ('async');

function testValidate (doc, schema, shouldPass, callback) {
    schema = new Likeness (schema);
    var sync = true;

    if (callback) {
        schema.validate (doc, function (err) {
            if (sync)
                return callback (new Error ('callback fired synchronously'));
            if (err)
                if (shouldPass) {
                    console.log (err);
                    return callback (new Error ('failed to pass the document'));
                } else return callback();
            if (shouldPass)
                return callback();
            callback (new Error ('failed to reject the document'));
        });
        sync = false;
        return;
    }

    try {
        schema.validate (doc);
        if (shouldPass) return;
    } catch (err) {
        assert (err instanceof Error, 'thrown Error is a real Error instance');
        if (!shouldPass) return;
        throw new Error ('failed to pass the document');
    }
    throw new Error ('failed to reject the document');
}

describe ("validate", function(){

    describe (".arbitrary", function(){

        it ("gets upset about extraneous properties, by default", function (done) {
            testValidate (
                { able:4 },
                { /* nothing */ },
                false,
                done
            );
        });

        it ("accepts the content of .arbitrary Objects", function (done) {
            testValidate (
                { able:4, baker:{ able:'four' }, charlie:[ { able:'able' } ]},
                { '.arbitrary':true },
                true,
                done
            );
        });

    });

    describe (".optional", function(){

        it ("gets upset about missing properties", function (done) {
            testValidate (
                { able:4, charlie:3 },
                { able:5, baker:5, charlie:5 },
                false,
                done
            );
        });

        it ("accepts the absence of .optional properties", function (done) {
            testValidate (
                { able:4, charlie:3 },
                { able:5, baker:{ '.type':'number', '.optional':true }, charlie:5 },
                true,
                done
            );
        });

    });

    describe ("simple constraints", function(){

        describe ("type", function(){
            var testDoc = {
                object:     {},
                array:      [],
                number:     42.7,
                integer:    39,
                string:     "This is my String. There are many like it, but this one is mine.",
                boolean:    true,
                deep:       {
                    blue:       {
                        object:     {},
                        array:      [],
                        number:     42,
                        string:     "This is my String. There are many like it, but this one is mine.",
                        boolean:    true,
                    }
                }
            };

            it ("constrains shallow properties by type", function (done) {
                async.parallel ([
                    function (callback) {
                        testValidate (
                            testDoc,
                            {
                                object:     { '.type':'object', '.arbitrary':true },
                                array:      { '.type':'array' },
                                number:     { '.type':'number' },
                                integer:    { '.type':'integer' },
                                string:     { '.type':'string' },
                                boolean:    { '.type':'boolean' },
                                deep:       { '.type':'object', '.arbitrary':true }
                            },
                            true,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { object:{ '.type':'array' } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { array:{ '.type':'object' } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { number:{ '.type':'string' } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { number:{ '.type':'int' } },
                            false,
                            callback
                        );
                    }
                ], done);
            });

            it ("constrains deep properties by type", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.adHoc':   true,
                        deep:       {
                            blue:       {
                                object:     { '.type':'object'  },
                                array:      { '.type':'array'   },
                                number:     { '.type':'number'  },
                                string:     { '.type':'string'  },
                                boolean:    { '.type':'boolean' }
                            }
                        }
                    },
                    true,
                    done
                );
            });

        });

        describe ("eval/async", function(){
            var testDoc = "foobarbaz";

            it ("validates the document when .eval is synchronously ok", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.eval':function (value) {
                            if (value !== "foobarbaz")
                                throw { error:'format', msg:'did not equal "foobarbaz"' };
                        }
                    },
                    true,
                    done
                );
            });

            it ("rejects the document when .eval is synchronously not ok", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.eval':function (value) {
                            if (value === "foobarbaz")
                                throw { error:'format', msg:'equals "foobarbaz"' };
                        }
                    },
                    false,
                    done
                );
            });

            it ("validates the document when .eval is asynchronously ok", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.eval':    function (value, callback) {
                            if (value === "foobarbaz")
                                return process.nextTick (callback);
                            process.nextTick (function(){ callback ({
                                error:      'format',
                                msg:        'did not equal "foobarbaz"',
                                value:      value
                            }); });
                        },
                        '.async':true
                    },
                    true,
                    done
                );
            });

            it ("rejects the document when .eval is asynchronously not ok", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.eval':    function (value, callback) {
                            if (value !== "foobarbaz")
                                return process.nextTick (callback);
                            process.nextTick (function(){ callback ({
                                error:      'format',
                                msg:        'did not equal "foobarbaz"',
                                value:      value
                            }); });
                        },
                        '.async':true
                    },
                    false,
                    done
                );
            });

        });

        describe ("Objects", function(){
            var testDoc = {
                able:       4,
                baker:      5,
                charlie:    6,
                dog:        7,
                easy:       8
            };

            it ("validates the document when .minKeys is satisfied", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.min':         4
                    },
                    true,
                    done
                );
            });

            it ("rejects the document when .minKeys is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.min':         8
                    },
                    false,
                    done
                );
            });

            it ("validates the document when .maxKeys is satisfied", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.max':         10
                    },
                    true,
                    done
                );
            });

            it ("rejects the document when .maxKeys is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.max':         4
                    },
                    false,
                    done
                );
            });

            it ("validates the document when .unique is satisfied");

            it ("validates the document when .unique is not satisfied");

            it ("validates .matchChildren", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo",
                        charlie:    "foo",
                        dog:        "foo",
                        easy:       "foo"
                    },
                    {
                        '.matchChildren':   {
                            e:                  { '.type':'string', '.value':"foo" }
                        },
                        dog:                { '.type':'string', '.value':"foo" }
                    },
                    true,
                    done
                );
            });

            it ("rejects .matchChildren", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo",
                        charlie:    "bar",
                        dog:        "bar",
                        easy:       "foo"
                    },
                    {
                        '.matchChildren':   {
                            e:                  { '.type':'string', '.value':"foo" }
                        },
                        dog:                { '.type':'string', '.value':"bar" }
                    },
                    false,
                    done
                );
            });

            it ("rejects .matchChildren and one illegal child", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo",
                        charlie:    "foo",
                        dog:        "foo",
                        easy:       "foo"
                    },
                    {
                        '.matchChildren':   {
                            e:                  { '.type':'string', '.value':"foo" }
                        }
                    },
                    false,
                    done
                );
            });

            it ("validates with .extra", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "bar"
                    },
                    {
                        able:       { '.type':'string', '.value':"foo" },
                        '.extra':   { '.type':'string', '.value':"bar" }
                    },
                    true,
                    done
                );
            });

            it ("rejects with .extra", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo"
                    },
                    {
                        able:       { '.type':'string', '.value':"foo" },
                        '.extra':   { '.type':'string', '.value':"bar" }
                    },
                    false,
                    done
                );
            });

            it ("validates with .matchChildren and .extra", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo",
                        charlie:    "foo",
                        dog:        "bar",
                        easy:       "foo"
                    },
                    {
                        '.matchChildren':   {
                            'e':                { '.type':'string', '.value':"foo" }
                        },
                        '.extra':           { '.type':'string', '.value':"bar" }
                    },
                    true,
                    done
                );
            });

            it ("rejects matched children and one illegal child", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo",
                        charlie:    "foo",
                        dog:        "foo",
                        easy:       "foo"
                    },
                    {
                        '.matchChildren':   {
                            'e':                { '.type':'string', '.value':"foo" }
                        }
                    },
                    false,
                    done
                );
            });

        });

        describe ("Arrays", function(){
            var testDoc = [ 'able', 'baker', 'charlie', 'dog', 'easy' ];

            it ("validates the document when .minVals is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.min':4 },
                    true,
                    done
                );
            });

            it ("rejects the document when .minVals is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.min':8 },
                    false,
                    done
                );
            });

            it ("validates the document when .maxVals is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.max':10 },
                    true,
                    done
                );
            });

            it ("rejects the document when .maxVals is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.max':4 },
                    false,
                    done
                );
            });

            it ("validates the document when a simple .sort is satisfied");

            it ("validates the document when a complex .sort is satisfied");

            it ("rejects the document when a simple .sort is not satisfied");

            it ("rejects the document when a complex .sort is not satisfied");

            it ("validates the document when .unique is satisfied", function (done) {
                testValidate (
                    [ 2, 4, 15, 'fifteen', '15', '2', 'too', 'two', 'TWO', 'Too', 2.2,
                        { able:10,      baker:'10' },
                        { able:'10',    baker:10 },
                        { able:10,      baker:9 },
                        { able:10,      baker:9,    charlie:9 },
                        { able:10,      baker:9,    charlie:10 }
                    ],
                    { '.type':'array', '.unique':true },
                    true,
                    done
                );
            });

            it ("rejects the document when .unique is not satisfied", function (done) {
                async.parallel ([
                    function (callback) {
                        testValidate (
                            [ 2, 4, 15, 'fifteen', 15, '15', '2', 'too', 'two', 'TWO', 'Too', 2.2,
                                { able:10,      baker:'10' },
                                { able:'10',    baker:10 },
                                { able:10,      baker:9 },
                                { able:10,      baker:9,    charlie:9 },
                                { able:10,      baker:9,    charlie:10 }
                            ],
                            { '.type':'array', '.unique':true },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            [ 2, 4, 15, 'fifteen', '15', '2', 'too', 'two', 'TWO', 'TWO', 'Too', 2.2,
                                { able:10,      baker:'10' },
                                { able:'10',    baker:10 },
                                { able:10,      baker:9 },
                                { able:10,      baker:9,    charlie:9 },
                                { able:10,      baker:9,    charlie:10 }
                            ],
                            { '.type':'array', '.unique':true },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            [ 2, 4, 15, 'fifteen', '15', '2', 'too', 'two', 'TWO', 'Too', 2.2,
                                { able:10,      baker:'10' },
                                { able:'10',    baker:10 },
                                { able:'10',    baker:10 },
                                { able:10,      baker:9 },
                                { able:10,      baker:9,    charlie:9 },
                                { able:10,      baker:9,    charlie:10 }
                            ],
                            { '.type':'array', '.unique':true },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            [ 2, 4, 15, 'fifteen', '15', '2', 'too', 'two', 'TWO', 'Too', 2.2,
                                { able:10,      baker:'10' },
                                { able:'10',    baker:10 },
                                { able:10,      baker:9 },
                                { able:10,      baker:9,    charlie:9 },
                                { able:10,      baker:9,    charlie:9 },
                                { able:10,      baker:9,    charlie:10 }
                            ],
                            { '.type':'array', '.unique':'true' },
                            false,
                            callback
                        );
                    } ], done);
            });

            it ("validates with a .sequence of schemas", function (done) {
                testValidate (
                    [ 2, 4, 6, 8 ],
                    { '.type':'array', '.sequence':[
                        { '.type':'number', '.gt':1, '.lt':3 },
                        { '.type':'number', '.gt':3, '.lt':5 },
                        { '.type':'number', '.gt':5, '.lt':7 },
                        { '.type':'number', '.gt':7, '.lt':9 }
                    ] },
                    true,
                    done
                );
            });

            it ("rejects with a .sequence of schemas", function (done) {
                testValidate (
                    [ 2, 4, 6, 8 ],
                    { '.type':'array', '.sequence':[
                        { '.type':'number', '.gt':1, '.lt':3 },
                        { '.type':'number', '.gt':3, '.lt':5 },
                        { '.type':'number', '.gt':5, '.lt':7 },
                        { '.type':'number', '.gt':7, '.lt':8 }
                    ] },
                    false,
                    done
                );
            });

            it ("rejects with a .sequence of schemas and unaccounted extras", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10 ],
                    { '.type':'array', '.sequence':[
                        { '.type':'number', '.gt':1, '.lt':3 },
                        { '.type':'number', '.gt':3, '.lt':5 },
                        { '.type':'number', '.gt':5, '.lt':7 },
                        { '.type':'number', '.gt':7, '.lt':9 }
                    ] },
                    false,
                    done
                );
            });

            it ("validates with .extra", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14 ],
                    {
                        '.type':    'array',
                        '.extra':   { '.type':'number', '.gt':1, '.lt':15 }
                    },
                    true,
                    done
                );
            });

            it ("rejects with .extra", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14, 16 ],
                    {
                        '.type':    'array',
                        '.extra':   { '.type':'number', '.gt':1, '.lt':15 }
                    },
                    false,
                    done
                );
            });

            it ("validates with .sequence and .extra", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14 ],
                    {
                        '.type':        'array',
                        '.sequence':    [
                            { '.type':'number', '.gt':1, '.lt':3 },
                            { '.type':'number', '.gt':3, '.lt':5 },
                            { '.type':'number', '.gt':5, '.lt':7 },
                            { '.type':'number', '.gt':7, '.lt':9 }
                        ],
                        '.extra':{ '.type':'number', '.gt':9, '.lt':15 }
                    },
                    true,
                    done
                );
            });

            it ("rejects with .sequence and .extra", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14, 16 ],
                    {
                        '.type':        'array',
                        '.sequence':    [
                            { '.type':'number', '.gt':1, '.lt':3 },
                            { '.type':'number', '.gt':3, '.lt':5 },
                            { '.type':'number', '.gt':5, '.lt':7 },
                            { '.type':'number', '.gt':7, '.lt':9 }
                        ],
                        '.extra':{ '.type':'number', '.gt':9, '.lt':15 }
                    },
                    false,
                    done
                );
            });

        });

        describe ("Strings", function(){
            var testDoc = "foobarbaz";

            it ("validates the document when .min is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.min':4 },
                    true,
                    done
                );
            });

            it ("rejects the document when .min is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.min':15 },
                    false,
                    done
                );
            });

            it ("validates the document when .max is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.max':15 },
                    true,
                    done
                );
            });

            it ("rejects the document when .max is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.max':4 },
                    false,
                    done
                );
            });

        });

        describe ("Numbers", function(){
            testDoc = 7;

            it ("validates the document when .min is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.min':4 },
                    true,
                    done
                );
            });

            it ("rejects the document when .min is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.min':10 },
                    false,
                    done
                );
            });

            it ("validates the document when .max is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.max':10 },
                    true,
                    done
                );
            });

            it ("rejects the document when .max is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.max':4 },
                    false,
                    done
                );
            });

            it ("validates the document when .modulo is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.modulo':[ 5, 2 ] },
                    true,
                    done
                );
            });

            it ("rejects the document when .modulo is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { '.modulo':[ 5, 3 ] },
                    false,
                    done
                );
            });

        });

    });

    describe ("predicate constraints", function(){

        describe ("Objects", function(){

            describe (".all", function(){

                it ("validates with a passing .all constraint", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.all':     { s:{ '.type':'number', '.min':4 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        true,
                        done
                    );
                });

                it ("rejects with a failing .all constraint", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.all':     { s:{ '.type':'number', '.min':6 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false,
                        done
                    );
                });

            });

            describe ("single .exists", function(){

                it ("validates with a passing .exists constraint", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  { s:{ '.type':'number', '.min':4 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        true,
                        done
                    );
                });

                it ("rejects with a failing .exists constraint", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  { s:{ '.type':'number', '.min':10 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false,
                        done
                    );
                });

            });

            describe (".exists and .times", function(){

                it ("validates with a passing .times constraint", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  { s:{ '.type':'number', '.min':6, '.times':3 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        true,
                        done
                    );
                });

                it ("rejects with a failing .times constraint", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  { s:{ '.type':'number', '.min':7 }, '.times':3 },
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false,
                        done
                    );
                });

                it ("validates with many passing .exists constraints", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8, x:'foo' } },
                        {
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':2, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ],
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        true,
                        done
                    );
                });

                it ("rejects with many passing and one failing .exist constraint", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ],
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false,
                        done
                    );
                });

                it ("rejects with many passing and one failing .exist constraint", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':2, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ],
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false,
                        done
                    );
                });

            });

            describe (".all and multiple .exists", function(){

                it ("validates with .all and many passing .exists constraints", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8, x:'foo' } },
                        {
                            '.all':     { s: { '.type':'number', '.min':0, '.max':10 }, '.arbitrary':true },
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':2, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ],
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        true,
                        done
                    );
                });

                it ("rejects with passing .all and mixed passing/failing .exists", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8, x:'foo' } },
                        {
                            '.all':     { s: { '.type':'number', '.min':0, '.max':10 }, '.arbitrary':true },
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ],
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false,
                        done
                    );
                });

                it ("rejects with many passing .exist constraints but failing .all", function (done) {
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8, x:'foo' } },
                        {
                            '.all':     { s:{ '.type':'number', '.min':0, '.max':7 }, x:{} },
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':2 },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ],
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false,
                        done
                    );
                });

            });

        });

        describe ("Arrays", function(){

            describe (".all", function(){

                it ("validates with a passing .all constraint", function (done) {
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        { '.all':{ s:{ '.type':'number', '.min':4 }} },
                        true,
                        done
                    );
                });

                it ("rejects with a failing .all constraint", function (done) {
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        { '.all':{ s:{ '.type':'number', '.min':7 }} },
                        false,
                        done
                    );
                });

            });

            describe (".exists and .times", function(){

                it ("validates with a passing .times constraint", function (done) {
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        {
                            '.type':    'array',
                            '.exists':  { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true }
                        },
                        true,
                        done
                    );
                });

                it ("rejects with a failing .times constraint", function (done) {
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        {
                            '.type':    'array',
                            '.exists':  { s:{ '.type':'number', '.min':7 }, '.times':3 }
                        },
                        false,
                        done
                    );
                });

                it ("validates with many passing .exists constraints", function (done) {
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8, x:'foo' } ],
                        {
                            '.type':    'array',
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':2, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ]
                        },
                        true,
                        done
                    );
                });

                it ("rejects with many passing and one failing .exist constraint", function (done) {
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8, x:'foo' } ],
                        {
                            '.type':    'array',
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }},
                                { s:{ '.type':'number', '.max':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ]
                        },
                        false,
                        done
                    );
                });

            });

            describe (".all and .exists", function(){

                it ("validates with .all and many passing .exists constraints", function (done) {
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8, x:'foo' } ],
                        {
                            '.all':     { s:{ '.type':'number', '.min':0, '.max':10 }, '.arbitrary':true },
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':2, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ]
                        },
                        true,
                        done
                    );
                });

                it ("rejects with passing .all and mixed passing/failing .exists", function (done) {
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8, x:'foo' } ],
                        {
                            '.all':     { s:{ '.type':'number', '.min':0, '.max':10 }, '.arbitrary':true },
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }},
                                { s:{ '.type':'number', '.max':6 }, '.times':2, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ]
                        },
                        false,
                        done
                    );
                });

                it ("rejects with many passing .exist constraints but failing .all",
                    function (done) {
                        testValidate (
                            [ { s:5 }, { s:6 }, { s:7 }, { s:8, x:'foo' } ],
                            {
                                '.all':     { s:{ '.type':'number', '.min':0, '.max':7 }, x:{} },
                                '.exists':  [
                                    { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                    { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                    { s:{ '.type':'number', '.max':6 }, '.times':2, '.arbitrary':true },
                                    { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                                ]
                            },
                            false,
                            done
                        );
                    }
                );

            });

        });

    });

    describe ("anyOf", function(){

        it ("matches one of several schema", function (done) {
            testValidate (
                { able:42 },
                { able:{ '.anyOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 },
                    { '.type':'number', '.gt':40 }
                ] } },
                true,
                done
            );
        });

        it ("fails to match any of several schema", function (done) {
            testValidate (
                { able:42 },
                { able:{ '.anyOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 }
                ] } },
                false,
                done
            );
        });

    });

    describe ("oneOf", function(){

        it ("matches exactly one of several schema", function (done) {
            testValidate (
                { able:42 },
                { able:{ '.oneOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 },
                    { '.type':'number', '.gt':40 }
                ] } },
                true,
                done
            );
        });

        it ("fails to match any of several schema", function (done) {
            testValidate (
                { able:42 },
                { able:{ '.oneOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 },
                ] } },
                false,
                done
            );
        });

        it ("fails to match due to too many passing schema", function (done) {
            testValidate (
                { able:42 },
                { able:{ '.oneOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 },
                    { '.type':'number', '.gt':40 },
                    { '.type':'number', '.gt':40 }
                ] } },
                false,
                done
            );
        });

    });

    describe ("not", function(){

        it ("matches when the inverse schema fails", function (done) {
            testValidate (
                { able:42 },
                { able:{ '.not':{ '.type':'number', '.gt':90 } } },
                true,
                done
            );
        });

        it ("fails when the inverse schema matches", function (done) {
            testValidate (
                { able:42 },
                { able:{ '.not':{ '.type':'number', '.gt':40 } } },
                false,
                done
            );
        });

    });

});
