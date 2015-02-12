
var assert = require ('assert');
var async = require ('async');
var likeness = require ('../../likeness');
var mergeJSONSchema = likeness.helpers.mergeJSONSchema;

describe ('.helpers#mergeJSONSchema', function(){

    it ("performs a deep merge with simple constraints", function(){
        var merged = mergeJSONSchema (
            {
                definitions:    {
                    foo:            {
                        properties:     {
                            able:           {
                                type:           "string"
                            }
                        }
                    }
                },
                properties:     {
                    able:           {
                        type:           "array",
                        items:          { $ref:"#/definitions/foo" }
                    },
                    baker:          {
                        patternProperties:{
                            "^\w*$":        {
                                properties:     {
                                    able:           { $ref:"#/definitions/foo" }
                                }
                            }
                        }
                    }
                }
            },
            {
                definitions:    {
                    foo:            {
                        properties:     {
                            baker:          {
                                type:           "string"
                            }
                        }
                    },
                    bar:            {
                        properties:     {
                            able:           {
                                type:           "string"
                            }
                        }
                    }
                },
                properties:     {
                    baker:          {
                        patternProperties: {
                            "^\w*$":        {
                                properties:     {
                                    baker:          { $ref:"#/definitions/foo" },
                                    charlie:        { $ref:"#/definitions/foo" }
                                }
                            },
                            "^\d*$":        {
                                properties:     {
                                    able:           { $ref:"#/definitions/foo" }
                                }
                            }
                        }
                    },
                    charlie:        {
                        type:           "string"
                    }
                }
            }
        );
        assert.deepEqual (merged, {
            definitions:    {
                foo:            {
                    properties:     {
                        able:           {
                            type:           "string"
                        },
                        baker:          {
                            type:           "string"
                        }
                    }
                },
                bar:            {
                    properties:     {
                        able:           {
                            type:           "string"
                        }
                    }
                }
            },
            properties:     {
                able:           {
                    type:           "array",
                    items:          { $ref:"#/definitions/foo" }
                },
                baker:          {
                    patternProperties: {
                        "^\w*$":        {
                            properties:     {
                                able:           { $ref:"#/definitions/foo" },
                                baker:          { $ref:"#/definitions/foo" },
                                charlie:        { $ref:"#/definitions/foo" }
                            }
                        },
                        "^\d*$":        {
                            properties:     {
                                able:           { $ref:"#/definitions/foo" }
                            }
                        }
                    }
                },
                charlie:        {
                    type:           "string"
                }
            }
        });
    });

    describe ("type", function(){

        it ("equal strings", function(){
            var merged = mergeJSONSchema (
                {
                    type:   "number"
                },
                {
                    type:   "number"
                }
            );
            assert.deepEqual (merged, {
                type:   "number"
            });
        });

        it ("unequal strings", function(){
            var merged = mergeJSONSchema (
                {
                    type:   "number"
                },
                {
                    type:   "string"
                }
            );
            assert.deepEqual (merged, {
                type:   [ "number", "string" ]
            });
        });

        it ("arrays", function(){
            var merged = mergeJSONSchema (
                {
                    type:   [ "number", "string" ]
                },
                {
                    type:   [ "string", "array" ]
                }
            );
            assert.deepEqual (merged, {
                type:   [ "number", "string", "array" ]
            });
        });

        it ("strings into arrays", function(){
            var merged = mergeJSONSchema (
                {
                    type:   "number"
                },
                {
                    type:   [ "number", "string" ]
                }
            );
            assert.deepEqual (merged, {
                type:   [ "number", "string" ]
            });
        });

    });

    describe ("dependencies", function(){

        it ("merges keys into keys");

        it ("merges schemata");

        it ("merges keys into schema");

    });

    describe ("aggressive overwrites", function(){

        it ("replaces `items` sequence with boolean");

        it ("replaces `items` boolean with sequence");

        it ("replaces `properties` boolean with schema");

        it ("replaces `properties` schema with boolean");

    });

});
