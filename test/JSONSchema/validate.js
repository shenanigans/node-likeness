
var async = require ('async');
var likeness = require ('../../likeness');

function testValidate (document, schema, isValid, callback) {
    var context = new likeness.helpers.JSContext();
    context.compile (schema, function (err, compiled, metaschema) {
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

            callback();
        });
    });
}

describe ("validate", function(){

    describe ("document structure", function(){

        it ("ignores extraneous properties by default", function (done) {
            testValidate (
                { able:4 },
                { /* empty schema */ },
                true,
                done
            );
        });

        it ("rejects extraneous properties with additionalProperties:false", function (done) {
            testValidate (
                { able:4, baker:{ able:'four' }, charlie:[ { able:'able' } ]},
                { additionalProperties:false },
                false,
                function (err) {
                    done (err);
                }
            );
        });

        it ("gets upset about missing required properties", function (done) {
            testValidate (
                { able:4, charlie:3 },
                { required:[ 'able', 'baker', 'charlie' ], properties:{
                    able:{ type:'number' }, baker:{ type:'number' }, charlie:{ type:'number' }
                } },
                false,
                done
            );
        });

        it ("ignores missing properties by default", function (done) {
            testValidate (
                { able:4, charlie:3 },
                { properties:{
                    able:{ type:'number' }, baker:{ type:'number' }, charlie:{ type:'number' }
                } },
                true,
                done
            );
        });

        it ("resolves a recursive schema", function (done) {
            async.parallel ([
                function (callback) {
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
                        { properties:{ able:{ $ref:'#' }, baker:{ type:'number' } } },
                        true,
                        callback
                    );
                },
                function (callback) {
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
                        { additionalProperties:false, properties:{
                            able:{ $ref:'#' }, baker:{ type:'number' }
                        } },
                        false,
                        callback
                    );
                }
            ], done);
        });

        describe ("dependencies", function(){

            it ("uses keys to require other keynames", function (done) {
                testValidate (
                    {
                        able:       9001,
                        baker:      9002,
                        charlie:    9003,
                        dog:        9004,
                        easy:       9005,
                        fox:        9006
                    },
                    { dependencies:{
                        able:[ 'baker' ],
                        charlie:[ 'dog' ],
                        easy:[ 'fox' ]
                    } },
                    true,
                    done
                );
            });

            it ("fails when dependencies cannot be met", function (done) {
                testValidate (
                    {
                        able:       9001,
                        baker:      9002,
                        charlie:    9003,
                        dog:        9004,
                        easy:       9005
                    },
                    { dependencies:{
                        able:[ 'baker' ],
                        charlie:[ 'dog' ],
                        easy:[ 'fox' ]
                    } },
                    false,
                    done
                );
            });

            it ("uses keys to requires keys which require keys etcetera", function (done) {
                testValidate (
                    {
                        able:       9001,
                        baker:      9002,
                        charlie:    9003,
                        dog:        9004,
                        easy:       9005,
                        fox:        9006
                    },
                    { dependencies:{
                        able:[ 'baker' ],
                        baker:[ 'charlie' ],
                        charlie:[ 'dog' ],
                        dog:[ 'easy' ],
                        easy:[ 'fox' ]
                    } },
                    true,
                    done
                );
            });

            it ("fails when chaining dependencies cannot be met", function (done) {
                testValidate (
                    {
                        able:       9001,
                        baker:      9002,
                        charlie:    9003,
                        dog:        9004,
                        easy:       9005
                    },
                    { dependencies:{
                        able:[ 'baker' ],
                        baker:[ 'charlie' ],
                        charlie:[ 'dog' ],
                        dog:[ 'easy' ],
                        easy:[ 'fox' ]
                    } },
                    false,
                    done
                );
            });

            it ("activates dependent schemata", function (done) {
                testValidate (
                    {
                        able:       9001,
                        baker:      9002
                    },
                    { dependencies:{
                        able:{ properties:{ baker:{ type:'number' } } }
                    } },
                    true,
                    done
                );
            });

            it ("fails when activated dependent schemata fail", function (done) {
                testValidate (
                    {
                        able:       9001,
                        baker:      "it's over nine thoooooouuuusaaaaaaaaaaand!!!"
                    },
                    { dependencies:{
                        able:{ properties:{ baker:{ type:'number' } } }
                    } },
                    false,
                    done
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

            it ("constrains shallow properties by type", function (done) {
                async.parallel ([
                    function (callback) {
                        testValidate (
                            testDoc,
                            { properties:{
                                object:     { type:'object', '.arbitrary':true },
                                array:      { type:'array' },
                                number:     { type:'number' },
                                integer:    { type:'integer' },
                                string:     { type:'string' },
                                boolean:    { type:'boolean' },
                                null:       { type:'null' },
                                deep:       { type:'object', '.arbitrary':true }
                            } },
                            true,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { required:[ 'object' ], properties:{ object:{ type:'array' } } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { required:[ 'array' ], properties:{ array:{ type:'object' } } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { required:[ 'number' ], properties:{ number:{ type:'string' } } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { required:[ 'number' ], properties:{ number:{ type:'integer' } } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { required:[ 'fauxNull0' ], properties:{ fauxNull0:{ type:'null' } } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { required:[ 'fauxNull1' ], properties:{ fauxNull1:{ type:'null' } } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { required:[ 'fauxNull2' ], properties:{ fauxNull2:{ type:'null' } } },
                            false,
                            callback
                        );
                    },
                    function (callback) {
                        testValidate (
                            testDoc,
                            { required:[ 'fauxNull3' ], properties:{ fauxNull3:{ type:'null' } } },
                            false,
                            callback
                        );
                    }
                ], done);
            });

            it ("constrains deep properties by type", function (done) {
                testValidate (
                    testDoc,
                    { properties:{
                        deep:       { properties:{
                            blue:       { properties:{
                                object:     { type:'object'  },
                                array:      { type:'array'   },
                                number:     { type:'number'  },
                                string:     { type:'string'  },
                                boolean:    { type:'boolean' }
                            }, required:[ 'object', 'array', 'number', 'string', 'boolean' ] }
                        }, required:[ 'blue' ] }
                    }, required:[ 'deep' ] },
                    true,
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

            it ("validates the document when minProperties is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { minProperties:4 },
                    true,
                    done
                );
            });

            it ("rejects the document when minProperties is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { minProperties:8 },
                    false,
                    done
                );
            });

            it ("validates the document when maxProperties is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { maxProperties:8 },
                    true,
                    done
                );
            });

            it ("rejects the document when maxProperties is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { maxProperties:4 },
                    false,
                    done
                );
            });

            it ("validates with patternProperties", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo",
                        charlie:    "foo",
                        dog:        "foo",
                        easy:       "foo"
                    },
                    { patternProperties:{ e:{ type:'string' } }, dog:{ type:'string' } },
                    true,
                    done
                );
            });

            it ("rejects with patternProperties", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "foo",
                        charlie:    77,
                        dog:        "bar",
                        easy:       "foo"
                    },
                    { patternProperties:{ e:{ type:'string' } }, dog:{ type:'string' } },
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
                    { patternProperties:{ e:{ type:'string' } }, additionalProperties:false },
                    false,
                    done
                );
            });

            it ("validates with additionalProperties", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      "bar"
                    },
                    { able:{ type:'string' }, additionalProperties:{ type:'string' } },
                    true,
                    done
                );
            });

            it ("rejects with additionalProperties", function (done) {
                testValidate (
                    {
                        able:       "foo",
                        baker:      99
                    },
                    { able:{ type:'string' }, additionalProperties:{ type:'string' } },
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
                        dog:        42,
                        easy:       "foo"
                    },
                    {
                        patternProperties:      { e:{ type:'string' } },
                        additionalProperties:   { type:'number' }
                    },
                    true,
                    done
                );
            });

        });

        describe ("Arrays", function(){
            var testDoc = [ 'able', 'baker', 'charlie', 'dog', 'easy' ];

            it ("validates the document when .minVals is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { minItems:4 },
                    true,
                    done
                );
            });

            it ("rejects the document when .minVals is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { minItems:8 },
                    false,
                    done
                );
            });

            it ("validates the document when .maxVals is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { maxItems:10 },
                    true,
                    done
                );
            });

            it ("rejects the document when .maxVals is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { maxItems:4 },
                    false,
                    done
                );
            });

            it ("validates the document when a simple sort is satisfied");

            it ("validates the document when a complex sort is satisfied");

            it ("rejects the document when a simple sort is not satisfied");

            it ("rejects the document when a complex sort is not satisfied");

            it ("validates the document when uniqueItems is satisfied", function (done) {
                testValidate (
                    [ 2, 4, 15, 'fifteen', '15', '2', 'too', 'two', 'TWO', 'Too', 2.2,
                        { able:10,      baker:'10' },
                        { able:'10',    baker:10 },
                        { able:10,      baker:9 },
                        { able:10,      baker:9,    charlie:9 },
                        { able:10,      baker:9,    charlie:10 }
                    ],
                    { type:'array', uniqueItems:true },
                    true,
                    done
                );
            });

            it ("rejects the document when uniqueItems is not satisfied", function (done) {
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
                            { type:'array', uniqueItems:true },
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
                            { type:'array', uniqueItems:true },
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
                            { type:'array', uniqueItems:true },
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
                            { type:'array', uniqueItems:'true' },
                            false,
                            callback
                        );
                    }
                ], done);
            });

            it ("validates with a sequence of schemas", function (done) {
                testValidate (
                    [ 2, 4, 6, 8 ],
                    { type:'array', additionalItems:false, items:[
                        { type:'number', minimum:1, maximum:3 },
                        { type:'number', minimum:3, maximum:5 },
                        { type:'number', minimum:5, maximum:7 },
                        { type:'number', minimum:7, maximum:9 }
                    ] },
                    true,
                    done
                );
            });

            it ("rejects with a sequence of schemas", function (done) {
                testValidate (
                    [ 2, 4, 6, 8 ],
                    { type:'array', additionalItems:false, items:[
                        { type:'number', minimum:1, maximum:3 },
                        { type:'number', minimum:3, maximum:5 },
                        { type:'number', minimum:5, maximum:7 },
                        { type:'number', minimum:6, maximum:7 }
                    ] },
                    false,
                    done
                );
            });

            it ("rejects with a sequence of schemas and illegal extra properties", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10 ],
                    { type:'array', additionalItems:false, items:[
                        { type:'number', minimum:1, maximum:3 },
                        { type:'number', minimum:3, maximum:5 },
                        { type:'number', minimum:5, maximum:7 },
                        { type:'number', minimum:7, maximum:9 }
                    ] },
                    false,
                    done
                );
            });

            it ("validates with additionalItems", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14 ],
                    { type:'array', additionalItems:{ type:'number', minimum:1, maximum:15 } },
                    true,
                    done
                );
            });

            it ("rejects with additionalItems", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14, 16 ],
                    { type:'array', additionalItems:{ type:'number', minimum:1, maximum:15 } },
                    false,
                    done
                );
            });

            it ("validates with sequence and additionalItems", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14 ],
                    {
                        type:               'array',
                        items:              [
                            { type:'number', minimum:1, maximum:3 },
                            { type:'number', minimum:3, maximum:5 },
                            { type:'number', minimum:5, maximum:7 },
                            { type:'number', minimum:7, maximum:9 }
                        ],
                        additionalItems:    { type:'number', minimum:9, maximum:15 }
                    },
                    true,
                    done
                );
            });

            it ("rejects with sequence and additionalItems", function (done) {
                testValidate (
                    [ 2, 4, 6, 8, 10, 12, 14, 16 ],
                    {
                        type:               'array',
                        items:              [
                            { type:'number', minimum:1, maximum:3 },
                            { type:'number', minimum:3, maximum:5 },
                            { type:'number', minimum:5, maximum:7 },
                            { type:'number', minimum:7, maximum:9 }
                        ],
                        additionalItems:    { type:'number', minimum:9, maximum:15 }
                    },
                    false,
                    done
                );
            });

        });

        describe ("Strings", function(){
            var testDoc = { able:"foobarbaz" };

            it ("validates the document when minLength is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { properties:{ able:{ type:'string', minLength:4 } }, required:[ 'able' ] },
                    true,
                    done
                );
            });

            it ("rejects the document when minLength is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { properties:{ able:{ type:'string', minLength:15 } }, required:[ 'able' ] },
                    false,
                    done
                );
            });

            it ("validates the document when maxLength is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { properties:{ able:{ type:'string', maxLength:15 } }, required:[ 'able' ] },
                    true,
                    done
                );
            });

            it ("rejects the document when maxLength is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { properties:{ able:{ type:'string', maxLength:4 } }, required:[ 'able' ] },
                    false,
                    done
                );
            });

            it ("accepts the document when format is satisfied", function (done) {
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
                        dog:        [ // the wikipedia example list
                            // commented email addresses are rfc-valid but do not validate
                            'niceandsimple@example.com',
                            'very.common@example.com',
                            'a.little.lengthy.but.fine@dept.example.com',
                            'disposable.style.email.with+symbol@example.com',
                            'other.email-with-dash@example.com',
                            'admin@mailserver1',
                            // '"much.more unusual"@example.com',
                            // '"very.unusual.@.unusual.com"@example.com',
                            // '"very.(),:;<>[]\".VERY.\"very@\\ \"very\".unusual"@strange.example.com',
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
                        able:       { type:'array', items:{ type:'string', format:'date' } },
                        baker:      { type:'array', items:{ type:'string', format:'time' } },
                        charlie:    { type:'array', items:{ type:'string', format:'date-time' } },
                        dog:        { type:'array', items:{ type:'string', format:'email' } },
                        easy:       { type:'array', items:{ type:'string', format:'hostname' } },
                        fox:        { type:'array', items:{ type:'string', format:'ipv4' } },
                        george:     { type:'array', items:{ type:'string', format:'ipv6' } },
                        hotel:      { type:'array', items:{ type:'string', format:'uri' } }
                    },
                    true,
                    done
                );
            });

        });

        describe ("Numbers", function(){
            testDoc = { able:7 };

            it ("validates the document when minimum is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { properties:{ able:{ type:'number', minimum:4 } }, required:[ 'able' ] },
                    true,
                    done
                );
            });

            it ("rejects the document when .min is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { properties:{ able:{ minimum:10 } }, required:[ 'able' ] },
                    false,
                    done
                );
            });

            it ("validates the document when .max is satisfied", function (done) {
                testValidate (
                    testDoc,
                    { properties:{ able:{ maximum:10 } }, required:[ 'able' ] },
                    true,
                    done
                );
            });

            it ("rejects the document when .max is not satisfied", function (done) {
                testValidate (
                    testDoc,
                    { properties:{ able:{ maximum:4 } }, required:[ 'able' ] },
                    false,
                    done
                );
            });

        });

    });

    describe ("metaschemata", function(){

        describe ("anyOf", function(){

            it ("matches one of several schema", function (done) {
                testValidate (
                    { able:42 },
                    { properties:{ able:{ anyOf:[
                        { type:'number', minimum:100 },
                        { type:'number', minimum:80 },
                        { type:'number', minimum:60 },
                        { type:'number', minimum:40 }
                    ] } } },
                    true,
                    done
                );
            });

            it ("fails to match any of several schema", function (done) {
                testValidate (
                    { able:42 },
                    { properties:{ able:{ anyOf:[
                        { type:'number', minimum:100 },
                        { type:'number', minimum:80 },
                        { type:'number', minimum:60 }
                    ] } } },
                    false,
                    done
                );
            });

        });

        describe ("oneOf", function(){

            it ("matches exactly one of several schema", function (done) {
                testValidate (
                    { able:42 },
                    { properties:{ able:{ oneOf:[
                        { type:'number', minimum:100 },
                        { type:'number', minimum:80 },
                        { type:'number', minimum:60 },
                        { type:'number', minimum:40 }
                    ] } } },
                    true,
                    done
                );
            });

            it ("fails to match any of several schema", function (done) {
                testValidate (
                    { able:42 },
                    { properties:{ able:{ oneOf:[
                        { type:'number', minimum:100 },
                        { type:'number', minimum:80 },
                        { type:'number', minimum:60 },
                    ] } } },
                    false,
                    done
                );
            });

            it ("fails to match due to too many passing schema", function (done) {
                testValidate (
                    { able:42 },
                    { properties:{ able:{ oneOf:[
                        { type:'number', minimum:100 },
                        { type:'number', minimum:80 },
                        { type:'number', minimum:60 },
                        { type:'number', minimum:40 },
                        { type:'number', minimum:40 }
                    ] } } },
                    false,
                    done
                );
            });

        });

        describe ("not", function(){

            it ("matches when the inverse schema fails", function (done) {
                testValidate (
                    { able:42 },
                    { properties:{ able:{ not:{ type:'number', minimum:90 } } } },
                    true,
                    done
                );
            });

            it ("fails when the inverse schema matches", function (done) {
                testValidate (
                    { able:42 },
                    { properties:{ able:{ not:{ type:'number', minimum:40 } } } },
                    false,
                    done
                );
            });

        });

    });

});
