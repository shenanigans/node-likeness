
var async = require ('async');
var likeness = require ('../../likeness');

function testCompile (id, doc, testDoc, callback) {
    if (arguments.length == 3) {
        callback = testDoc;
        testDoc = doc;
        doc = id;
        id = doc.id || 'http://schemata.example.com/sauce/schema';
    }
    var context = new likeness.helpers.JSContext();
    context.compile (id, doc, function (err, compiled, metaschema) {
        if (err) return callback (err);
        likeness.helpers.fromJSONSchema (metaschema, compiled, function (err, likeSchema) {
            if (err) return callback (err, compiled);
            var likeTest = new likeness (likeSchema);
            try {
                likeTest.validate (testDoc);
            } catch (err) {
                return callback (err instanceof Error ? err : new Error (err), compiled);
            }
            callback (undefined, compiled);
        });
    });
}

describe ("compile", function(){

    it ("compiles local references", function (done) {

        testCompile (
            {
                definitions:{
                    human: {
                        properties: {
                            fullName: {
                                type: "string",
                                minLength: 4,
                                maxLength: 256
                            },
                            ssn: {
                                type:  "string",
                                pattern: "\\d{3}-\\d{2}-\\d{4}"
                            }
                        },
                        additionalProperties: false
                    }
                },
                properties:     {
                    activeUser:     {
                        $ref:       "#/definitions/human",
                        properties: {
                            permissionsLevel: {
                                type:       "string",
                                enum:       [
                                    "guest",
                                    "user",
                                    "admin"
                                ]
                            }
                        }
                    }
                }
            },
            {
                activeUser: {
                    fullName: "Dan Lather",
                    ssn: "123-45-6789",
                    permissionsLevel: "user"
                }
            },
            done
        );

    });

    describe ("recursive references", function(){

        it ("compiles with local direct recursion", function (done) {
            testCompile (
                {
                    definitions: {
                        human: {
                            properties: {
                                fullName: {
                                    type: "string",
                                    minLength: 4,
                                    maxLength: 256
                                },
                                ssn: {
                                    type:  "string",
                                    pattern: "\\d{3}-\\d{2}-\\d{4}"
                                },
                                contacts: {
                                    type: "array",
                                    items: { $ref:'#/definitions/human' }
                                }
                            },
                            additionalProperties: false
                        }
                    },
                    properties:     {
                        activeUser:     {
                            $ref: "#/definitions/human",
                            properties:     {
                                permissionsLevel: {
                                    type: "string",
                                    enum: [
                                        "guest",
                                        "user",
                                        "admin"
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    activeUser: {
                        fullName: "Dan Lather",
                        ssn: "123-45-6789",
                        permissionsLevel: "user",
                        contacts: [
                            {
                                fullName: "Pambit",
                                ssn: "123-45-6789",
                                permissionsLevel: "user",
                                contacts: [
                                    {
                                        fullName: "Blob Marley",
                                        ssn: "123-45-6789",
                                        permissionsLevel: "user"
                                    },
                                    {
                                        fullName: "Sammy Gayvis Junior",
                                        ssn: "123-45-6789",
                                        permissionsLevel: "user"
                                    }
                                ]
                            },
                            {
                                fullName: "Blob Marley",
                                ssn: "123-45-6789",
                                permissionsLevel: "user"
                            },
                            {
                                fullName: "Sammy Gayvis Junior",
                                ssn: "123-45-6789",
                                permissionsLevel: "user"
                            }
                        ]
                    }
                },
                done
            );
        });

        it ("compiles a local reference chain", function (done) {
            testCompile (
                {
                    foo:{ properties:{ able:{ $ref:"#/bar" } }, additionalProperties:false },
                    bar:{ properties:{ baker:{ $ref:"#/baz" } }, additionalProperties:false },
                    baz:{ properties:{ charlie:{ type:'number' } }, additionalProperties:false },
                    properties:{ first:{ $ref:"#/foo" } },
                },
                { first:{ able:{ baker:{ charlie:9001 } } } },
                done
            );
        });

        it ("compiles a local reference loop", function (done) {
            testCompile (
                {
                    foo:{ properties:{ able:{ $ref:"#/bar" } }, additionalProperties:false },
                    bar:{ properties:{ baker:{ $ref:"#/foo" } }, additionalProperties:false },
                    properties:{ first:{ $ref:"#/foo" } },
                    additionalProperties:false
                },
                { first:{ able:{ baker:{ able:{ baker:{ able:{ baker:{ } } } } } } } },
                done
            );
        });

        it ("compiles with common ancestor recursion", function (done) {
            testCompile (
                {
                    definitions:    {
                        doodad:         {
                            properties:     {
                                able:           { $ref:'#' }
                            },
                            required:       [ 'able' ]
                        }
                    },
                    properties:     {
                        baker:          { $ref:'#/definitions/doodad' }
                    }
                },
                {
                    baker:  {
                        able:   {
                            baker:  {
                                able:   {
                                    baker:  {
                                        able:   { }
                                    }
                                }
                            }
                        }
                    }
                },
                done
            );
        });

        it ("compiles with local foreign ancestor recursion", function (done) {
            testCompile (
                {
                    definitions: {
                        human:      {
                            social:     {
                                properties: {
                                    fullName: {
                                        type: "string",
                                        minLength: 4,
                                        maxLength: 256
                                    },
                                    ssn: {
                                        type:  "string",
                                        pattern: "\\d{3}-\\d{2}-\\d{4}"
                                    },
                                    contacts: {
                                        type: "array",
                                        items: { $ref:'#/definitions/human' }
                                    }
                                },
                                additionalProperties: false
                            }
                        }
                    },
                    properties:     {
                        activeUser:     {
                            $ref: "#/definitions/human/social",
                            properties:     {
                                permissionsLevel: {
                                    type: "string",
                                    enum: [
                                        "guest",
                                        "user",
                                        "admin"
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    activeUser: {
                        fullName: "Dan Lather",
                        ssn: "123-45-6789",
                        permissionsLevel: "user",
                        contacts: [
                            {
                                fullName: "Pambit",
                                ssn: "123-45-6789",
                                permissionsLevel: "user",
                                contacts: [
                                    {
                                        fullName: "Blob Marley",
                                        ssn: "123-45-6789",
                                        permissionsLevel: "user"
                                    },
                                    {
                                        fullName: "Sammy Gayvis Junior",
                                        ssn: "123-45-6789",
                                        permissionsLevel: "user"
                                    }
                                ]
                            },
                            {
                                fullName: "Blob Marley",
                                ssn: "123-45-6789",
                                permissionsLevel: "user"
                            },
                            {
                                fullName: "Sammy Gayvis Junior",
                                ssn: "123-45-6789",
                                permissionsLevel: "user"
                            }
                        ]
                    }
                },
                done
            );
        });

    });

    it ("compiles remote references", function (done) {

        testCompile (
            {
                properties: {
                    able:       {
                        $ref:       'http://127.0.0.1:9999/simple.json'
                    }
                },
                required:   [ 'able' ]
            },
            {
                able:   {
                    able:   4,
                    baker:  'four'
                }
            },
            done
        );

    });

    it ("compiles remote local references", function (done) {

        testCompile (
            {
                type:       "object",
                properties: {
                    able:       { $ref:'http://127.0.0.1:9999/localref.json' }
                }
            },
            {
                able:       {
                    able:       4,
                    baker:      {
                        able:       'four'
                    }
                }
            },
            done
        );

    });

    it ("compiles sequential remote references", function (done) {

        testCompile (
            {
                properties: {
                    able:       { $ref:'http://127.0.0.1:9999/remoterefA.json' }
                }
            },
            {
                able:   {
                    able:   4,
                    baker:  {
                        able:   {
                            able:   "four"
                        }
                    }
                }
            },
            done
        );

    });

    it ("compiles remote references to recursive schemata", function (done) {

        testCompile (
            {
                properties: {
                    able:       { $ref:'http://127.0.0.1:9999/remote/recursive.json' }
                },
                additionalProperties:   false
            },
            {
                able:       {
                    able:       4,
                    baker:      {
                        able:       5,
                        baker:      {
                            able:       6
                        }
                    }
                }
            },
            done
        );

    });

    it ("compiles remote reference loop", function (done) {

        testCompile (
            {
                properties: {
                    start:      {
                        $ref:       'http://127.0.0.1:9999/refloopA.json'
                    }
                },
                required:   [ 'start' ]
            },
            {
                start:      {
                    able:       {
                        baker:      {
                            charlie:    {
                                able:       {
                                    baker:      {
                                        charlie:    { }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            done
        );

    });

});
