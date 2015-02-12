
var Likeness = require ('../../Likeness');
var assert = require ('assert');

function testValidate (doc, schema, shouldPass, callback) {
    schema = new Likeness (schema);

    if (callback)
        return schema.validate (doc, function (err) {
            if (err)
                if (shouldPass)
                    return callback (new Error ('failed to pass the document'));
                else return callback();
            if (shouldPass)
                return callback();
            callback (new Error ('failed to reject the document'));
        });

    try {
        schema.validate (doc);
        if (shouldPass) return;
    } catch (err) {
        assert (err instanceof Error, 'thrown Error is a real Error instance');
        if (!shouldPass) return;
        console.log (err);
        throw new Error ('failed to pass the document');
    }
    throw new Error ('failed to reject the document');
}

describe ("validate", function(){

    describe ("document structure", function(){

        it ("gets upset about extraneous properties, by default", function(){
            testValidate (
                { able:4 },
                { /* nothing */ },
                false
            );
        });

        it ("accepts the content of .arbitrary Objects", function(){
            testValidate (
                { able:4, baker:{ able:'four' }, charlie:[ { able:'able' } ]},
                { '.arbitrary':true },
                true
            );
        });

        it ("gets upset about missing properties", function(){
            testValidate (
                { able:4, charlie:3 },
                { able:5, baker:5, charlie:5 },
                false
            );
        });

        it ("accepts the absence of .optional properties", function(){
            testValidate (
                { able:4, charlie:3 },
                { able:5, baker:{ '.type':'number', '.optional':true }, charlie:5 },
                true
            );
        });

        it ("resolves a recursive schema", function(){
            testValidate (
                {
                    able:   {
                        able:   {
                            able:   {
                                able:   {
                                    baker:  42
                                },
                                baker:  9
                            },
                            baker:  11
                        },
                        baker:  9001
                    },
                    baker:  78
                },
                { able:{ '.optional':true, '.recurse':1 }, baker:{ '.type':'number' }},
                true
            );
            testValidate (
                {
                    able:   {
                        able:   {
                            able:   {
                                able:   {
                                    baker:  42
                                },
                                baker:   9,
                                charlie: 7
                            },
                            baker:  11
                        },
                        baker:  9001
                    },
                    baker:  78
                },
                { able:{ '.optional':true, '.recurse':1 }, baker:{ '.type':'number' }},
                false
            );
        });

        describe (".dependencies", function(){

            it ("uses keys to require other keynames", function(){
                testValidate (
                    {
                        able:       9001,
                        baker:      9002,
                        charlie:    9003,
                        dog:        9004,
                        easy:       9005,
                        fox:        9006
                    },
                    { '.arbitrary':true, '.all':{ '.type':'number' }, '.dependencies':{
                        able:[ 'baker' ],
                        charlie:[ 'dog' ],
                        easy:[ 'fox' ]
                    } },
                    true
                );
            });

            it ("fails when dependencies cannot be met", function(){
                testValidate (
                    {
                        able:       9001,
                        baker:      9002,
                        charlie:    9003,
                        dog:        9004,
                        easy:       9005
                    },
                    { '.arbitrary':true, '.all':{ '.type':'number' }, '.dependencies':{
                        able:[ 'baker' ],
                        charlie:[ 'dog' ],
                        easy:[ 'fox' ]
                    } },
                    false
                );
            });

            it ("uses keys to requires keys which require keys etcetera", function(){
                testValidate (
                    {
                        able:       9001,
                        baker:      9002,
                        charlie:    9003,
                        dog:        9004,
                        easy:       9005,
                        fox:        9006
                    },
                    { '.arbitrary':true, '.all':{ '.type':'number' }, '.dependencies':{
                        able:[ 'baker' ],
                        baker:[ 'charlie' ],
                        charlie:[ 'dog' ],
                        dog:[ 'easy' ],
                        easy:[ 'fox' ]
                    } },
                    true
                );
            });

            it ("fails when chaining dependencies cannot be met", function(){
                testValidate (
                    {
                        able:       9001,
                        baker:      9002,
                        charlie:    9003,
                        dog:        9004,
                        easy:       9005
                    },
                    { '.arbitrary':true, '.all':{ '.type':'number' }, '.dependencies':{
                        able:[ 'baker' ],
                        baker:[ 'charlie' ],
                        charlie:[ 'dog' ],
                        dog:[ 'easy' ],
                        easy:[ 'fox' ]
                    } },
                    false
                );
            });

            it ("activates dependent schemata", function(){
                testValidate (
                    {
                        able:       9001,
                        baker:      9002
                    },
                    { '.arbitrary':true, '.all':{ '.type':'number' }, '.dependencies':{
                        able:{ baker:{ '.type':'number' } }
                    } },
                    true
                );
            });

            it ("fails when activated dependent schemata fail", function(){
                testValidate (
                    {
                        able:       9001,
                        baker:      "it's over nine thoooooouuuusaaaaaaaaaaand!!!"
                    },
                    { '.arbitrary':true, '.all':{ '.type':'number' }, '.dependencies':{
                        able:{ baker:{ '.type':'number' } }
                    } },
                    false
                );
            });

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
                null:       null,
                fauxNull0:  0,
                fauxNull1:  'null',
                fauxNull2:  false,
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
                testValidate (
                    testDoc,
                    { '.arbitrary':true,
                        object:     { '.type':'object', '.arbitrary':true },
                        array:      { '.type':'array' },
                        number:     { '.type':'number' },
                        integer:    { '.type':'integer' },
                        string:     { '.type':'string' },
                        boolean:    { '.type':'boolean' },
                        null:       { '.type':'null' },
                        deep:       { '.type':'object', '.arbitrary':true }
                    },
                    true
                );
                testValidate (
                    testDoc,
                    { '.arbitrary':true, object:{ '.type':'array' } },
                    false
                );
                testValidate (
                    testDoc,
                    { '.arbitrary':true, array:{ '.type':'object' } },
                    false
                );
                testValidate (
                    testDoc,
                    { '.arbitrary':true, number:{ '.type':'string' } },
                    false
                );
                testValidate (
                    testDoc,
                    { '.arbitrary':true, number:{ '.type':'int' } },
                    false
                );
                testValidate (
                    testDoc,
                    { '.arbitrary':true, fauxNull0:{ '.type':'null' } },
                    false
                );
                testValidate (
                    testDoc,
                    { '.arbitrary':true, fauxNull1:{ '.type':'null' } },
                    false
                );
                testValidate (
                    testDoc,
                    { '.arbitrary':true, fauxNull2:{ '.type':'null' } },
                    false
                );
                testValidate ( // does not interperet missing key as null
                    testDoc,
                    { '.arbitrary':true, fauxNull3:{ '.type':'null' } },
                    false
                );
            });

            it ("constrains deep properties by type", function(){
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
                    true
                );
            });

        });

        describe ("eval/async", function(){
            var testDoc = "foobarbaz";

            it ("validates the document when .eval is ok", function(){
                testValidate (
                    testDoc,
                    {
                        '.eval':function (value) {
                            if (value !== "foobarbaz")
                                throw { error:'format', msg:'did not equal "foobarbaz"' };
                        }
                    },
                    true
                );
            });

            it ("rejects the document when .eval is not ok", function(){
                testValidate (
                    testDoc,
                    {
                        '.eval':function (value) {
                            if (value === "foobarbaz")
                                throw { error:'format', msg:'should not equal "foobarbaz"' };
                        }
                    },
                    false
                );
            });

            it ("throws an Error when .async is set and no callback is passed", function(){
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
                    false
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

            it ("validates the document when .minKeys is satisfied", function(){
                testValidate (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.min':         4
                    },
                    true
                );
            });

            it ("rejects the document when .minKeys is not satisfied", function(){
                testValidate (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.min':         8
                    },
                    false
                );
            });

            it ("validates the document when .maxKeys is satisfied", function(){
                testValidate (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.max':         10
                    },
                    true
                );
            });

            it ("rejects the document when .maxKeys is not satisfied", function(){
                testValidate (
                    testDoc,
                    {
                        '.arbitrary':   true,
                        '.max':         4
                    },
                    false
                );
            });

            it ("validates the document when .unique is satisfied");

            it ("validates the document when .unique is not satisfied");

            it ("validates .matchChildren", function(){
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
                    true
                );
            });

            it ("rejects .matchChildren", function(){
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
                    false
                );
            });

            it ("rejects .matchChildren and one illegal child", function(){
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
                    false
                );
            });

            it ("validates with .extra", function(){
                testValidate (
                    {
                        able:       "foo",
                        baker:      "bar"
                    },
                    {
                        able:       { '.type':'string', '.value':"foo" },
                        '.extra':   { '.type':'string', '.value':"bar" }
                    },
                    true
                );
            });

            it ("rejects with .extra", function(){
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo"
                    },
                    {
                        able:       { '.type':'string', '.value':"foo" },
                        '.extra':   { '.type':'string', '.value':"bar" }
                    },
                    false
                );
            });

            it ("validates with .matchChildren and .extra", function(){
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
                    true
                );
            });

            it ("rejects matched children and one illegal child", function(){
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
                    false
                );
            });

        });

        describe ("Arrays", function(){
            var testDoc = [ 'able', 'baker', 'charlie', 'dog', 'easy' ];

            it ("validates the document when .minVals is satisfied", function(){
                testValidate (
                    testDoc,
                    { '.min':4 },
                    true
                );
            });

            it ("rejects the document when .minVals is not satisfied", function(){
                testValidate (
                    testDoc,
                    { '.min':8 },
                    false
                );
            });

            it ("validates the document when .maxVals is satisfied", function(){
                testValidate (
                    testDoc,
                    { '.max':10 },
                    true
                );
            });

            it ("rejects the document when .maxVals is not satisfied", function(){
                testValidate (
                    testDoc,
                    { '.max':4 },
                    false
                );
            });

            it ("validates the document when a simple .sort is satisfied");

            it ("validates the document when a complex .sort is satisfied");

            it ("rejects the document when a simple .sort is not satisfied");

            it ("rejects the document when a complex .sort is not satisfied");

            it ("validates the document when .unique is satisfied", function(){
                testValidate (
                    [ 2, 4, 15, 'fifteen', '15', '2', 'too', 'two', 'TWO', 'Too', 2.2,
                        { able:10,      baker:'10' },
                        { able:'10',    baker:10 },
                        { able:10,      baker:9 },
                        { able:10,      baker:9,    charlie:9 },
                        { able:10,      baker:9,    charlie:10 }
                    ],
                    { '.type':'array', '.unique':true },
                    true
                );
            });

            it ("rejects the document when .unique is not satisfied", function(){
                testValidate (
                    [ 2, 4, 15, 'fifteen', 15, '15', '2', 'too', 'two', 'TWO', 'Too', 2.2,
                        { able:10,      baker:'10' },
                        { able:'10',    baker:10 },
                        { able:10,      baker:9 },
                        { able:10,      baker:9,    charlie:9 },
                        { able:10,      baker:9,    charlie:10 }
                    ],
                    { '.type':'array', '.unique':true },
                    false
                );
                testValidate (
                    [ 2, 4, 15, 'fifteen', '15', '2', 'too', 'two', 'TWO', 'TWO', 'Too', 2.2,
                        { able:10,      baker:'10' },
                        { able:'10',    baker:10 },
                        { able:10,      baker:9 },
                        { able:10,      baker:9,    charlie:9 },
                        { able:10,      baker:9,    charlie:10 }
                    ],
                    { '.type':'array', '.unique':true },
                    false
                );
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
                    false
                );
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
                    false
                );
            });

            it ("validates with a .sequence of schemas", function(){
                testValidate (
                    [ 2, 4, 6, 8 ],
                    { '.type':'array', '.sequence':[
                        { '.type':'number', '.gt':1, '.lt':3 },
                        { '.type':'number', '.gt':3, '.lt':5 },
                        { '.type':'number', '.gt':5, '.lt':7 },
                        { '.type':'number', '.gt':7, '.lt':9 }
                    ] },
                    true
                );
            });

            it ("rejects with a .sequence of schemas", function(){
                testValidate (
                    [ 2, 4, 6, 8 ],
                    { '.type':'array', '.sequence':[
                        { '.type':'number', '.gt':1, '.lt':3 },
                        { '.type':'number', '.gt':3, '.lt':5 },
                        { '.type':'number', '.gt':5, '.lt':7 },
                        { '.type':'number', '.gt':7, '.lt':8 }
                    ] },
                    false
                );
            });

            it ("rejects with a .sequence of schemas and unaccounted extras", function(){
                testValidate (
                    [ 2, 4, 6, 8, 10 ],
                    { '.type':'array', '.sequence':[
                        { '.type':'number', '.gt':1, '.lt':3 },
                        { '.type':'number', '.gt':3, '.lt':5 },
                        { '.type':'number', '.gt':5, '.lt':7 },
                        { '.type':'number', '.gt':7, '.lt':9 }
                    ] },
                    false
                );
            });

            it ("validates with .extra", function(){
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14 ],
                    {
                        '.type':    'array',
                        '.extra':   { '.type':'number', '.gt':1, '.lt':15 }
                    },
                    true
                );
            });

            it ("rejects with .extra", function(){
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14, 16 ],
                    {
                        '.type':    'array',
                        '.extra':   { '.type':'number', '.gt':1, '.lt':15 }
                    },
                    false
                );
            });

            it ("validates with .sequence and .extra", function(){
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
                    true
                );
            });

            it ("rejects with .sequence and .extra", function(){
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
                    false
                );
            });

        });

        describe ("Strings", function(){
            var testDoc = "foobarbaz";

            it ("validates the document when .min is satisfied", function(){
                testValidate (
                    testDoc,
                    { '.min':4 },
                    true
                );
            });

            it ("rejects the document when .min is not satisfied", function(){
                testValidate (
                    testDoc,
                    { '.min':15 },
                    false
                );
            });

            it ("validates the document when .max is satisfied", function(){
                testValidate (
                    testDoc,
                    { '.max':15 },
                    true
                );
            });

            it ("rejects the document when .max is not satisfied", function(){
                testValidate (
                    testDoc,
                    { '.max':4 },
                    false
                );
            });

            it ("accepts the document when .format is satisfied", function(){
                testValidate (
                    {
                        able:       [
                            "2002-10-02"
                        ],
                        baker:      [
                            "10:00:00"
                        ],
                        charlie:    [
                            "2002-10-02T10:00:00-05:00",
                            "2002-10-02T15:00:00Z",
                            "2002-10-02T15:00:00.05Z"
                        ],
                        dog:        [
                            'niceandsimple@example.com',
                            'very.common@example.com',
                            'a.little.lengthy.but.fine@dept.example.com',
                            'disposable.style.email.with+symbol@example.com',
                            'other.email-with-dash@example.com',
                            // the regex I picked up isn't very complete...
                            // '"much.more unusual"@example.com',
                            // '"very.unusual.@.unusual.com"@example.com',
                            // '"very.(),:;<>[]\".VERY.\"very@\\ \"very\".unusual"@strange.example.com',
                            'admin@mailserver1',
                            // ' !#$%&*+-/=?\'^_`{}|~@example.org',
                            // '"()<>[]:,;@\\\"!#$%&\'*+-/=?^_`{}| ~.a"@example.org',
                            // '" "@example.org',
                            // 'üñîçøðé@example.com',
                            // 'üñîçøðé@üñîçøðé.com'
                        ],
                        easy:       [
                            'example.com',
                            'foo.bar.example.mit.edu'
                        ],
                        fox:        [
                            '10.10.100.12', '210.21.210.99', '127.0.0.1'
                        ],
                        george:     [
                            'FE80:0000:0000:0000:0202:B3FF:FE1E:8329',
                            'FE80:0:0:0:0202:B3FF:FE1E:8329',
                            'FE80::0202:B3FF:FE1E:8329'
                        ],
                        hotel:      [
                            'ftp://ftp.is.co.za/rfc/rfc1808.txt',
                            'http://www.ietf.org/rfc/rfc2396.txt',
                            'ldap://[2001:db8::7]/c=GB?objectClass?one',
                            'mailto:John.Doe@example.com',
                            'news:comp.infosystems.www.servers.unix',
                            'tel:+1-816-555-1212',
                            'telnet://192.0.2.16:80/',
                            'urn:oasis:names:specification:docbook:dtd:xml:4.1.2'
                        ]
                    },
                    {
                        able:       { '.type':'array', '.all':{ '.type':'string', '.format':'date' } },
                        baker:      { '.type':'array', '.all':{ '.type':'string', '.format':'time' } },
                        charlie:    { '.type':'array', '.all':{ '.type':'string', '.format':'date-time' } },
                        dog:        { '.type':'array', '.all':{ '.type':'string', '.format':'email' } },
                        easy:       { '.type':'array', '.all':{ '.type':'string', '.format':'hostname' } },
                        fox:        { '.type':'array', '.all':{ '.type':'string', '.format':'ipv4' } },
                        george:     { '.type':'array', '.all':{ '.type':'string', '.format':'ipv6' } },
                        hotel:      { '.type':'array', '.all':{ '.type':'string', '.format':'uri' } }
                    },
                    true
                );
            });

            it ("accepts the document with .keyFormat", function(){
                testValidate (
                    {
                        'very.common@example.com':                          9001,
                        'a.little.lengthy.but.fine@dept.example.com':       9002,
                        'disposable.style.email.with+symbol@example.com':   9003
                    },
                    {
                        '.keyFormat':'email'
                    },
                    true
                );
            });

        });

        describe ("Numbers", function(){
            testDoc = 7;

            it ("validates the document when .min is satisfied", function(){
                testValidate (
                    testDoc,
                    { '.min':4 },
                    true
                );
            });

            it ("rejects the document when .min is not satisfied", function(){
                testValidate (
                    testDoc,
                    { '.min':10 },
                    false
                );
            });

            it ("validates the document when .max is satisfied", function(){
                testValidate (
                    testDoc,
                    { '.max':10 },
                    true
                );
            });

            it ("rejects the document when .max is not satisfied", function(){
                testValidate (
                    testDoc,
                    { '.max':4 },
                    false
                );
            });

            it ("validates the document when .modulo is satisfied", function(){
                testValidate (
                    testDoc,
                    { '.modulo':[ 5, 2 ] },
                    true
                );
            });

            it ("rejects the document when .modulo is not satisfied", function(){
                testValidate (
                    testDoc,
                    { '.modulo':[ 5, 3 ] },
                    false
                );
            });

        });

    });

    describe ("predicate constraints", function(){

        describe ("Objects", function(){

            describe (".all", function(){

                it ("validates with a passing .all constraint", function(){
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.all':     { s:{ '.type':'number', '.min':4 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        true
                    );
                });

                it ("rejects with a failing .all constraint", function(){
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.all':     { s:{ '.type':'number', '.min':6 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false
                    );
                });

            });

            describe ("single .exists", function(){

                it ("validates with a passing .exists constraint", function(){
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  { s:{ '.type':'number', '.min':4 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        true
                    );
                });

                it ("rejects with a failing .exists constraint", function(){
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  { s:{ '.type':'number', '.min':10 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false
                    );
                });

            });

            describe (".exists and .times", function(){

                it ("validates with a passing .times constraint", function(){
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  { s:{ '.type':'number', '.min':6, '.times':3 }},
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        true
                    );
                });

                it ("rejects with a failing .times constraint", function(){
                    testValidate (
                        { able:{ s:5 }, baker:{ s:6 }, charlie:{ s:7 }, dog:{ s:8 } },
                        {
                            '.exists':  { s:{ '.type':'number', '.min':7 }, '.times':3 },
                            able:       { '.type':'object', '.arbitrary':true },
                            baker:      { '.type':'object', '.arbitrary':true },
                            charlie:    { '.type':'object', '.arbitrary':true },
                            dog:        { '.type':'object', '.arbitrary':true }
                        },
                        false
                    );
                });

                it ("validates with many passing .exists constraints", function(){
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
                        true
                    );
                });

                it ("rejects with many passing and one failing .exist constraint", function(){
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
                        false
                    );
                });

                it ("rejects with many passing and one failing .exist constraint", function(){
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
                        false
                    );
                });

            });

            describe (".all and multiple .exists", function(){

                it ("validates with .all and many passing .exists constraints", function(){
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
                        true
                    );
                });

                it ("rejects with passing .all and mixed passing/failing .exists", function(){
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
                        false
                    );
                });

                it ("rejects with many passing .exist constraints but failing .all", function(){
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
                        false
                    );
                });

            });

        });

        describe ("Arrays", function(){

            describe (".all", function(){

                it ("validates with a passing .all constraint", function(){
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        { '.all':{ s:{ '.type':'number', '.min':4 }} },
                        true
                    );
                });

                it ("rejects with a failing .all constraint", function(){
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        { '.all':{ s:{ '.type':'number', '.min':7 }} },
                        false
                    );
                });

            });

            describe (".exists and .times", function(){

                it ("validates with a passing .times constraint", function(){
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        {
                            '.type':    'array',
                            '.exists':  { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true }
                        },
                        true
                    );
                });

                it ("rejects with a failing .times constraint", function(){
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8 } ],
                        {
                            '.type':    'array',
                            '.exists':  { s:{ '.type':'number', '.min':7 }, '.times':3, '.arbitrary':true }
                        },
                        false
                    );
                });

                it ("validates with many passing .exists constraints", function(){
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
                        true
                    );
                });

                it ("rejects with many passing and one failing .exist constraint", function(){
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8, x:'foo' } ],
                        {
                            '.type':    'array',
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number', '.min':8 }, '.arbitrary':true },
                                { s:{ '.type':'number', '.max':6 }, '.times':3, '.arbitrary':true },
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ]
                        },
                        false
                    );
                });

                it ("rejects with many passing and one failing .exist constraint", function(){
                    testValidate (
                        [ { s:5 }, { s:6 }, { s:7 }, { s:8, x:'foo' } ],
                        {
                            '.type':    'array',
                            '.exists':  [
                                { s:{ '.type':'number', '.min':6, '.times':3, '.arbitrary':true }},
                                { s:{ '.type':'number', '.min':8 }},
                                { s:{ '.type':'number', '.max':6, '.times':2, '.arbitrary':true }},
                                { s:{ '.type':'number' }, x:{ '.type':'string', '.value':"foo" }}
                            ]
                        },
                        false
                    );
                });

            });

            describe (".all and .exists", function(){

                it ("validates with .all and many passing .exists constraints", function(){
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
                        true
                    );
                });

                it ("rejects with passing .all and mixed passing/failing .exists", function(){
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
                        false
                    );
                });

                it ("rejects with many passing .exist constraints but failing .all", function(){
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
                        false
                    );
                });

            });

        });

    });

    describe ("anyOf", function(){

        it ("matches one of several schema", function(){
            testValidate (
                { able:42 },
                { able:{ '.anyOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 },
                    { '.type':'number', '.gt':40 }
                ] } },
                true
            );
        });

        it ("fails to match any of several schema", function(){
            testValidate (
                { able:42 },
                { able:{ '.anyOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 }
                ] } },
                false
            );
        });

    });

    describe ("oneOf", function(){

        it ("matches exactly one of several schema", function(){
            testValidate (
                { able:42 },
                { able:{ '.oneOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 },
                    { '.type':'number', '.gt':40 }
                ] } },
                true
            );
        });

        it ("fails to match any of several schema", function(){
            testValidate (
                { able:42 },
                { able:{ '.oneOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 },
                ] } },
                false
            );
        });

        it ("fails to match due to too many passing schema", function(){
            testValidate (
                { able:42 },
                { able:{ '.oneOf':[
                    { '.type':'number', '.gt':100 },
                    { '.type':'number', '.gt':80 },
                    { '.type':'number', '.gt':60 },
                    { '.type':'number', '.gt':40 },
                    { '.type':'number', '.gt':40 }
                ] } },
                false
            );
        });

    });

    describe ("not", function(){

        it ("matches when the inverse schema fails", function(){
            testValidate (
                { able:42 },
                { able:{ '.not':{ '.type':'number', '.gt':90 } } },
                true
            );
        });

        it ("fails when the inverse schema matches", function(){
            testValidate (
                { able:42 },
                { able:{ '.not':{ '.type':'number', '.gt':40 } } },
                false
            );
        });

    });

});
