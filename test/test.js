
var Likeness = require ('../Likeness');
var helpers = require ('../helpers');

function testSchema (doc, schema, shouldPass, callback) {
    schema = new Likeness (schema);

    if (callback)
        try {
            return schema.validate (doc, function (err, isValid) {
                if (err)
                    if (shouldPass) return callback (err);
                    else return callback();
                if (isValid && shouldPass)
                    return callback();
                if (!isValid && !shouldPass)
                    return callback();
                return callback (new Error ('failed to '+(shouldPass?'pass':'reject')+' the document'));
            });
        } catch (err) {
            // async evaluation must never throw
            return callback (err);
        }

    try {
        var result = schema.validate (doc);
    } catch (err) {
        if (!shouldPass) return;
        throw err;
    }

    if (result && shouldPass)
        return;
    if (!result && !shouldPass)
        return;
    throw new Error ('failed to '+(shouldPass?'pass':'reject')+' the document');
}

describe ("arbitrary, Synchronous", function(){
    it ("gets upset about extraneous properties, by default", function(){
        testSchema (
            { able:4 },
            { /* nothing */ },
            false
        );
    });
    it ("accepts the content of .arbitrary Objects", function(){
        testSchema (
            { able:4, baker:{ able:'four' }, charlie:[ { able:'able' } ]},
            { '.arbitrary':true },
            true
        );
    });
});

describe ("arbitrary, Asynchronous", function(){
    it ("gets upset about extraneous properties, by default", function (done) {
        testSchema (
            { able:4 },
            { /* nothing */ },
            false,
            done
        );
    });
    it ("accepts the content of .arbitrary Objects", function (done) {
        testSchema (
            { able:4, baker:{ able:'four' }, charlie:[ { able:'able' } ]},
            { '.arbitrary':true },
            true,
            done
        );
    });
});

describe ("optional, Synchronous", function(){
    it ("gets upset about missing properties", function(){
        testSchema (
            { able:4, charlie:3 },
            { able:5, baker:5, charlie:5 },
            false
        );
    });
    it ("accepts the absence of .optional properties", function(){
        testSchema (
            { able:4, charlie:3 },
            { able:5, baker:{ '.type':'number', '.optional':true }, charlie:5 },
            true
        );
    });
});

describe ("optional, Asynchronous", function(){
    it ("gets upset about missing properties", function (done) {
        testSchema (
            { able:4, charlie:3 },
            { able:5, baker:5, charlie:5 },
            false,
            done
        );
    });
    it ("accepts the absence of .optional properties", function (done) {
        testSchema (
            { able:4, charlie:3 },
            { able:5, baker:{ '.type':'number', '.optional':true }, charlie:5 },
            true,
            done
        );
    });
});

describe ("simple constraints, Synchronous", function(){
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

        it ("constrains shallow properties by type", function(){
            testSchema (
                testDoc,
                {
                    object:     { '.type':'object' },
                    array:      { '.type':'array' },
                    number:     { '.type':'number' },
                    string:     { '.type':'string' },
                    boolean:    { '.type':'boolean' },
                    deep:       { '.type':'object', '.arbitrary':true }
                },
                true
            );
        });
        it ("constrains deep properties by type", function(){
            testSchema (
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
                true
            );
        });
    });
    describe ("eval/async", function(){
        var testDoc = "foobarbaz";

        it ("validates the document when .eval is ok", function(){
            testSchema (
                testDoc,
                { '.eval':function (value) { return value === "foobarbaz"; } },
                true
            );
        });
        it ("rejects the document when .eval is not ok", function(){
            testSchema (
                testDoc,
                { '.eval':function (value) { return value !== "foobarbaz"; } },
                false
            );
        });
        it ("throws an Error when .async is set and no callback is passed", function(){
            testSchema (
                testDoc,
                { '.eval':function (value) { return value === "foobarbaz"; }, '.async':true },
                false
            );
        });
    });
    describe ("Object min/max/length", function(){
        var testDoc = {
            able:       4,
            baker:      5,
            charlie:    6,
            delta:      7,
            epsilon:    8
        };
        it ("validates the document when .minKeys is satisfied", function(){
            testSchema (
                testDoc,
                {
                    '.arbitrary':   true,
                    '.min':         4
                },
                true
            );
        });
        it ("rejects the document when .minKeys is not satisfied", function(){
            testSchema (
                testDoc,
                {
                    '.arbitrary':   true,
                    '.min':         8
                },
                false
            );
        });
        it ("validates the document when .maxKeys is satisfied", function(){
            testSchema (
                testDoc,
                {
                    '.arbitrary':   true,
                    '.max':         10
                },
                true
            );
        });
        it ("rejects the document when .maxKeys is not satisfied", function(){
            testSchema (
                testDoc,
                {
                    '.arbitrary':   true,
                    '.max':         4
                },
                false
            );
        });
    });
    describe ("Array min/max/length", function(){
        var testDoc = [ 'able', 'baker', 'charlie', 'delta', 'epsilon' ];
        it ("validates the document when .minVals is satisfied", function(){
            testSchema (
                testDoc,
                { '.min':4 },
                true
            );
        });
        it ("rejects the document when .minVals is not satisfied", function(){
            testSchema (
                testDoc,
                { '.min':8 },
                false
            );
        });
        it ("validates the document when .maxVals is satisfied", function(){
            testSchema (
                testDoc,
                { '.max':10 },
                true
            );
        });
        it ("rejects the document when .maxVals is not satisfied", function(){
            testSchema (
                testDoc,
                { '.max':4 },
                false
            );
        });
    });
    describe ("String length/match", function(){
        var testDoc = "foobarbaz";

        it ("validates the document when .min is satisfied", function(){
            testSchema (
                testDoc,
                { '.min':4 },
                true
            );
        });
        it ("rejects the document when .min is not satisfied", function(){
            testSchema (
                testDoc,
                { '.min':15 },
                false
            );
        });
        it ("validates the document when .max is satisfied", function(){
            testSchema (
                testDoc,
                { '.max':15 },
                true
            );
        });
        it ("rejects the document when .max is not satisfied", function(){
            testSchema (
                testDoc,
                { '.max':4 },
                false
            );
        });
    });
    describe ("Numbers min/max/modulo", function(){
        testDoc = 7;

        it ("validates the document when .min is satisfied", function(){
            testSchema (
                testDoc,
                { '.min':4 },
                true
            );
        });
        it ("rejects the document when .min is not satisfied", function(){
            testSchema (
                testDoc,
                { '.min':10 },
                false
            );
        });
        it ("validates the document when .max is satisfied", function(){
            testSchema (
                testDoc,
                { '.max':10 },
                true
            );
        });
        it ("rejects the document when .max is not satisfied", function(){
            testSchema (
                testDoc,
                { '.max':4 },
                false
            );
        });
        it ("validates the document when .modulo is satisfied", function(){
            testSchema (
                testDoc,
                { '.modulo':[ 5, 2 ] },
                true
            );
        });
        it ("rejects the document when .modulo is not satisfied", function(){
            testSchema (
                testDoc,
                { '.modulo':[ 5, 3 ] },
                false
            );
        });
    });
});

describe ("simple constraints, Asynchronous", function(){
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
            testSchema (
                testDoc,
                {
                    object:     { '.type':'object' },
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
            testSchema (
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
            testSchema (
                testDoc,
                { '.eval':function (value) { return value === "foobarbaz"; } },
                true,
                done
            );
        });
        it ("rejects the document when .eval is synchronously not ok", function (done) {
            testSchema (
                testDoc,
                { '.eval':function (value) { return value !== "foobarbaz"; } },
                false,
                done
            );
        });
        it ("validates the document when .eval is asynchronously ok", function (done) {
            testSchema (
                testDoc,
                { '.async':true, '.eval':function (value, callback) {
                    callback (undefined, value === "foobarbaz");
                }},
                true,
                done
            );
        });
        it ("rejects the document when .eval is asynchronously not ok", function (done) {
            testSchema (
                testDoc,
                { '.async':true, '.eval':function (value, callback) {
                    callback (undefined, value !== "foobarbaz");
                }},
                false,
                done
            );
        });
        it ("rejects the document when .eval asynchronously raises an Error", function (done) {
            testSchema (
                testDoc,
                { '.async':true, '.eval':function (value, callback) {
                    callback (new Error ("Where's Bill?"));
                }},
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
            delta:      7,
            epsilon:    8
        };
        it ("validates the document when .minKeys is satisfied", function (done) {
            testSchema (
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
            testSchema (
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
            testSchema (
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
            testSchema (
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
        var testDoc = [ 'able', 'baker', 'charlie', 'delta', 'epsilon' ];
        it ("validates the document when .minVals is satisfied", function (done) {
            testSchema (
                testDoc,
                { '.min':4 },
                true,
                done
            );
        });
        it ("rejects the document when .minVals is not satisfied", function (done) {
            testSchema (
                testDoc,
                { '.min':8 },
                false,
                done
            );
        });
        it ("validates the document when .maxVals is satisfied", function (done) {
            testSchema (
                testDoc,
                { '.max':10 },
                true,
                done
            );
        });
        it ("rejects the document when .maxVals is not satisfied", function (done) {
            testSchema (
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
            testSchema (
                testDoc,
                { '.min':4 },
                true,
                done
            );
        });
        it ("rejects the document when .min is not satisfied", function (done) {
            testSchema (
                testDoc,
                { '.min':15 },
                false,
                done
            );
        });
        it ("validates the document when .max is satisfied", function (done) {
            testSchema (
                testDoc,
                { '.max':15 },
                true,
                done
            );
        });
        it ("rejects the document when .max is not satisfied", function (done) {
            testSchema (
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
            testSchema (
                testDoc,
                { '.min':4 },
                true,
                done
            );
        });
        it ("rejects the document when .min is not satisfied", function (done) {
            testSchema (
                testDoc,
                { '.min':10 },
                false,
                done
            );
        });
        it ("validates the document when .max is satisfied", function (done) {
            testSchema (
                testDoc,
                { '.max':10 },
                true,
                done
            );
        });
        it ("rejects the document when .max is not satisfied", function (done) {
            testSchema (
                testDoc,
                { '.max':4 },
                false,
                done
            );
        });
        it ("validates the document when .modulo is satisfied", function (done) {
            testSchema (
                testDoc,
                { '.modulo':[ 5, 2 ] },
                true,
                done
            );
        });
        it ("rejects the document when .modulo is not satisfied", function (done) {
            testSchema (
                testDoc,
                { '.modulo':[ 5, 3 ] },
                false,
                done
            );
        });
    });
});

describe ("predicate constraints, Synchronous", function(){

});

describe ("predicate constraints, Asynchronous", function(){

});

describe ("transforms, Synchronous", function(){

});

describe ("transforms, Asynchronous", function(){

});

