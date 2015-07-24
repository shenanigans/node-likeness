
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
        // console.log (JSON.stringify (compiled));
        likeness.helpers.fromJSONSchema (metaschema, compiled, function (err, likeSchema) {
            if (err) return callback (err);
            // console.log (JSON.stringify (likeSchema));
            var likeTest = new likeness (likeSchema);
            try {
                likeTest.validate (testDoc);
            } catch (err) {
                console.log (err);
                console.log (compiled);
                return callback (err instanceof Error ? err : new Error (err));
            }
            callback();
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

    it ("compiles remote references");

    it ("compiles remote references to recursive schemata");

    it ("detects local reference loops");

    it ("detects remote reference loops");

});
