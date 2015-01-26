
var Likeness = require ('../../Likeness');
var assert = require ('assert');

function testReport (doc, schema, shouldPass, callback) {
    schema = new Likeness (schema);
    var errors = [];
    var sync = true;

    if (callback) {
        schema.report (doc, errors, function(){
            if (sync)
                return callback (new Error ('callback fired synchronously'));
            if (shouldPass && errors.length)
                return callback (new Error ('failed to pass the document'));
            if (!shouldPass && !errors.length)
                return callback (new Error ('failed to reject the document'));
            callback();
        });
        sync = false;
        return;
    }

    schema.report (doc, errors);
    for (var i in errors)
        assert (errors[i] instanceof Error, 'reported Error is a real Error instance');

    if (shouldPass && errors.length)
        throw new Error ('failed to pass the document');
    if (!shouldPass && !errors.length)
        throw new Error ('failed to reject the document');
}

describe ("report", function(){

    describe (".arbitrary", function(){

        it ("gets upset about extraneous properties, by default", function (done) {
            testReport (
                { able:4 },
                { /* nothing */ },
                false,
                done
            );
        });

        it ("accepts the content of .arbitrary Objects", function (done) {
            testReport (
                { able:4, baker:{ able:'four' }, charlie:[ { able:'able' } ]},
                { '.arbitrary':true },
                true,
                done
            );
        });

    });

    describe (".optional", function(){

        it ("gets upset about missing properties", function (done) {
            testReport (
                { able:4, charlie:3 },
                { able:5, baker:5, charlie:5 },
                false,
                done
            );
        });

        it ("accepts the absence of .optional properties", function (done) {
            testReport (
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
                number:     42,
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
                testReport (
                    testDoc,
                    {
                        object:     { '.type':'object', '.arbitrary':true },
                        array:      { '.type':'array' },
                        number:     { '.type':'number' },
                        string:     { '.type':'string' },
                        boolean:    { '.type':'boolean' },
                        deep:       { '.type':'object', '.arbitrary':true }
                    },
                    true,
                    done
                );
            });

            it ("constrains deep properties by type", function (done) {
                testReport (
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
                testReport (
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
                testReport (
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
                testReport (
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
                testReport (
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

        describe ("Object min/max/length", function(){
            var testDoc = {
                able:       4,
                baker:      5,
                charlie:    6,
                dog:        7,
                easy:       8
            };

            it ("validates the document when .minKeys is satisfied", function (done) {
                testReport (
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
                testReport (
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
                testReport (
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
                testReport (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.max':         4
                    },
                    false,
                    done
                );
            });

        });

        describe ("Array min/max/length", function(){
            var testDoc = [ 'able', 'baker', 'charlie', 'dog', 'easy' ];

            it ("validates the document when .minVals is satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.min':4 },
                    true,
                    done
                );
            });

            it ("rejects the document when .minVals is not satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.min':8 },
                    false,
                    done
                );
            });

            it ("validates the document when .maxVals is satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.max':10 },
                    true,
                    done
                );
            });

            it ("rejects the document when .maxVals is not satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.max':4 },
                    false,
                    done
                );
            });

        });

        describe ("String length/match", function(){
            var testDoc = "foobarbaz";

            it ("validates the document when .min is satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.min':4 },
                    true,
                    done
                );
            });

            it ("rejects the document when .min is not satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.min':15 },
                    false,
                    done
                );
            });

            it ("validates the document when .max is satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.max':15 },
                    true,
                    done
                );
            });

            it ("rejects the document when .max is not satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.max':4 },
                    false,
                    done
                );
            });

        });

        describe ("Numbers min/max/modulo", function(){
            testDoc = 7;

            it ("validates the document when .min is satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.min':4 },
                    true,
                    done
                );
            });

            it ("rejects the document when .min is not satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.min':10 },
                    false,
                    done
                );
            });

            it ("validates the document when .max is satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.max':10 },
                    true,
                    done
                );
            });

            it ("rejects the document when .max is not satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.max':4 },
                    false,
                    done
                );
            });

            it ("validates the document when .modulo is satisfied", function (done) {
                testReport (
                    testDoc,
                    { '.modulo':[ 5, 2 ] },
                    true,
                    done
                );
            });

            it ("rejects the document when .modulo is not satisfied", function (done) {
                testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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

                it ("rejects with passing .all and mixed passing/failing .exists", function (done) {
                    testReport (
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
                    testReport (
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
                    testReport (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        { '.all':{ s:{ '.type':'number', '.min':4 }} },
                        true,
                        done
                    );
                });

                it ("rejects with a failing .all constraint", function (done) {
                    testReport (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        { '.all':{ s:{ '.type':'number', '.min':7 }} },
                        false,
                        done
                    );
                });

            });

            describe (".exists and .times", function(){

                it ("validates with a passing .times constraint", function (done) {
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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
                    testReport (
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

                it ("rejects an with passing .all and mixed passing/failing .exists", function (done) {
                    testReport (
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
                        testReport (
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

});
