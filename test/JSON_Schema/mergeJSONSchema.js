
var assert = require ('assert');
var async = require ('async');
var likeness = require ('../../likeness');
var mergeJSONSchema = likeness.helpers.mergeJSONSchema;
var metaschema = require ('../../helpers/JSPredefs/draft04');

describe ('.helpers#mergeJSONSchema', function(){

    it ("performs a deep merge with simple constraints", function(){
        var merged = mergeJSONSchema (metaschema,
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

        it ("accepts equal strings", function(){
            var merged = mergeJSONSchema (metaschema,
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

        it ("throws Error with unequal strings", function(){
            try {
                var merged = mergeJSONSchema (metaschema,
                    {
                        type:   "number"
                    },
                    {
                        type:   "string"
                    }
                );
            } catch (err) {
                return;
            }
            throw new Error ('failed to throw error when compiling to an always-fail schema');
        });

        it ("creates an Array with unequal strings and asInheritence=true", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   "number"
                },
                {
                    type:   "string"
                },
                true
            );
            assert.deepEqual (merged, {
                type:   [ "number", "string" ]
            });
        })

        it ("intersects two arrays", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   [ "number", "string", "array" ]
                },
                {
                    type:   [ "string", "array", "object" ]
                }
            );
            assert.deepEqual (merged, {
                type:   [ "string", "array" ]
            });
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   [ "number", "string" ]
                },
                {
                    type:   [ "string", "array" ]
                }
            );
            assert.deepEqual (merged, { type:"string" });
        });

        it ("unions two arrays with asInheritence=true", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   [ "number" ]
                },
                {
                    type:   [ "string", "number" ]
                },
                true
            );
            assert.deepEqual (merged, {
                type:   [ "number", "string" ]
            });
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   [ "number" ]
                },
                {
                    type:   [ "number" ]
                },
                true
            );
            assert.deepEqual (merged, { type:"number" });
        });

        it ("throws an Error when intersecting two arrays results in an empty set", function(){
            try {
                var merged = mergeJSONSchema (metaschema,
                    {
                        type:   [ "number", "string" ]
                    },
                    {
                        type:   [ "object", "array" ]
                    }
                );
            } catch (err) {
                return;
            }
            throw new Error ('failed to throw error when compiling to an always-fail schema');
        });

        it ("intersects a string with an array", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   "number"
                },
                {
                    type:   [ "number", "string" ]
                }
            );
            assert.deepEqual (merged, {
                type:   "number"
            });
        });

        it ("unions a string with an array when asInheritence=true", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   "array"
                },
                {
                    type:   [ "number", "string" ]
                },
                true
            );
            assert.deepEqual (merged, {
                type:   [ "array", "number", "string" ]
            });
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   "number"
                },
                {
                    type:   [ "number", "string" ]
                },
                true
            );
            assert.deepEqual (merged, {
                type:   [ "number", "string" ]
            });
        });

        it ("intersects a array with an string", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   [ "number", "string" ]
                },
                {
                    type:   "number"
                }
            );
            assert.deepEqual (merged, {
                type:   "number"
            });
        });

        it ("throws an Error when a type is not found in a array of types", function(){
            try {
                var merged = mergeJSONSchema (metaschema,
                    {
                        type:   "number"
                    },
                    {
                        type:   [ "object", "array" ]
                    }
                );
            } catch (err) {
                return;
            }
            throw new Error ('failed to throw error when compiling to an always-fail schema');
        });

        it ("throws an Error when an array of types does not contain a string type", function(){
            try {
                var merged = mergeJSONSchema (metaschema,
                    {
                        type:   [ "object", "array" ]
                    },
                    {
                        type:   "number"
                    }
                );
            } catch (err) {
                return;
            }
            throw new Error ('failed to throw error when compiling to an always-fail schema');
        });

        it ("unions an array with a string when asInheritence=true", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   [ "number", "string" ]
                },
                {
                    type:   "array"
                },
                true
            );
            assert.deepEqual (merged, {
                type:   [ "number", "string", "array" ]
            });
            var merged = mergeJSONSchema (metaschema,
                {
                    type:   [ "number", "string" ]
                },
                {
                    type:   "number"
                },
                true
            );
            assert.deepEqual (merged, {
                type:   [ "number", "string" ]
            });
        });

    });

    describe ("dependencies", function(){

        it ("merges keys into keys", function(){
            var merged = mergeJSONSchema (metaschema,
                { dependencies:{ able:[ 'baker', 'charlie' ] } },
                { dependencies:{ able:[ 'dog', 'easy' ], fox:[ 'george' ] } }
            );
            assert.deepEqual (merged, {
                dependencies:{ able:[ 'baker', 'charlie', 'dog', 'easy' ], fox:[ 'george' ] }
            });
        });

        it ("merges schemata", function(){
            var merged = mergeJSONSchema (metaschema,
                { dependencies:{
                    able:    { properties:{ baker:   { minimum:10 } } },
                    baker:   { properties:{ charlie: { minimum:10 } } }
                } },
                { dependencies:{
                    able:    { properties:{ charlie: { minimum:10 } } },
                    charlie: { properties:{ able:    { minimum:10 } } }
                } }
            );
            assert.deepEqual (merged, { dependencies:{
                able:    { properties:{
                    baker:   { minimum:10 },
                    charlie: { minimum:10 }
                } },
                baker:   { properties:{
                    charlie: { minimum:10 }
                } },
                charlie: { properties:{
                    able:    { minimum:10 },
                } }
            } });
        });

        it ("merges keys into schema", function(){
            var merged = mergeJSONSchema (metaschema,
                { dependencies:{ able:{ required:[ 'able', 'baker' ] } } },
                { dependencies:{ able:[ 'baker', 'charlie' ] } }
            );
            assert.deepEqual (merged, { dependencies:{ able:{
                required:[ 'able', 'baker', 'charlie' ]
            } } });
        });

        it ("merges schema into keys", function(){
            var merged = mergeJSONSchema (metaschema,
                { dependencies:{ able:[ 'baker', 'charlie' ] } },
                { dependencies:{ able:{ required:[ 'able', 'baker' ] } } }
            );
            assert.deepEqual (merged, { dependencies:{ able:{
                required:[ 'able', 'baker', 'charlie' ]
            } } });
        });

    });

    describe ("required", function(){

        it ("requires the union of requirement arrays", function(){
            var merged = mergeJSONSchema (metaschema,
                { required:[ 'able', 'baker', 'charlie' ] },
                { required:[ 'charlie', 'dog', 'easy' ] }
            );
            assert.deepEqual (merged, { required:[ 'able', 'baker', 'charlie', 'dog', 'easy' ] });
        });

    });

    describe ("tricky overwrites", function(){

        it ("merges two schemata sequences", function(){
            var merged = mergeJSONSchema (metaschema,
                { items:[ { type:'number' }, { type:'number' } ] },
                { items:[ { minimum:10 }, { minimum:20 } ] }
            );
            assert.deepEqual (merged, {
                items:[ { type:'number', minimum:10 }, { type:'number', minimum:20 } ]
            });
        });

        it ("fills missing sequence schemata with additionalItems schema", function(){
            var merged = mergeJSONSchema (metaschema,
                { items:[ { type:'number' }, { type:'number' } ] },
                { items:[ { minimum:10 } ], additionalItems:{ minimum:9000 } }
            );
            assert.deepEqual (merged, {
                items:[ { type:'number', minimum:10 }, { type:'number', minimum:9000 } ],
                additionalItems:{ minimum:9000 }
            });
        });

        it ("distributes `items` schema in parent across sequence in child", function(){
            var merged = mergeJSONSchema (metaschema,
                { items:{ type:'number' } },
                { items:[ { minimum:10 }, { minimum:20 }, { minimum:30 } ] }
            );
            assert.deepEqual (merged, { items:[
                { type:'number', minimum:10 },
                { type:'number', minimum:20 },
                { type:'number', minimum:30 }
            ] });
        });

        it ("distributes `items` sequence in child across sequence in parent", function(){
            var merged = mergeJSONSchema (metaschema,
                { items:[ { minimum:10 }, { minimum:20 }, { minimum:30 } ] },
                { items:{ type:'number' } }
            );
            assert.deepEqual (merged, { items:[
                { type:'number', minimum:10 },
                { type:'number', minimum:20 },
                { type:'number', minimum:30 }
            ] });
        });

        it ("throws an error when sequence is too short and additionalItems is false", function(){
            try {
                var merged = mergeJSONSchema (metaschema,
                    { items:[ { type:'number' }, { type:'string' } ] },
                    { items:[ { minimum:10 } ], additionalItems:false }
                );
            } catch (err) {
                return;
            }
            throw new Error ('did not throw an Error');
        });

        it ("distributes `additionalProperties` to unknown `properties`", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    properties:{ able:{ type:'string' } },
                    additionalProperties:{ type:'number' }
                },
                { properties:{ able:{}, baker:{ minimum:10 } } }
            );
            assert.deepEqual (merged, {
                properties:{ able:{ type:'string' }, baker:{ type:'number', minimum:10 } },
                additionalProperties:{ type:'number' }
            });
        });

        it ("replaces `additionalProperties` boolean true with schema", function(){
            var merged = mergeJSONSchema (metaschema,
                { additionalProperties:true },
                { additionalProperties:{ type:'number' } }
            );
            assert.deepEqual (merged, { additionalProperties:{ type:'number' } });
        });

        it ("retains `additionalProperties` boolean false with schema", function(){
            var merged = mergeJSONSchema (metaschema,
                { additionalProperties:false },
                { additionalProperties:{ type:'number' } }
            );
            assert.deepEqual (merged, { additionalProperties:false });
        });


        it ("replaces `additionalProperties` schema with boolean false", function(){
            var merged = mergeJSONSchema (metaschema,
                { additionalProperties:{ type:'number' } },
                { additionalProperties:false }
            );
            assert.deepEqual (merged, { additionalProperties:false });
        });

        it ("retains `additionalProperties` schema with boolean true", function(){
            var merged = mergeJSONSchema (metaschema,
                { additionalProperties:{ type:'number' } },
                { additionalProperties:true }
            );
            assert.deepEqual (merged, { additionalProperties:{ type:'number' } });
        });

        it ("strips properties ignored by additionalProperties=false", function(){
            var merged = mergeJSONSchema (metaschema,
                { properties:{ able:{ type:'number' } }, additionalProperties:false },
                { properties:{ able:{ minimum:10 }, baker:{ minimum:20 } } }
            );
            assert.deepEqual (merged, {
                properties:{ able:{ type:'number', minimum:10 } },
                additionalProperties:false
            });
        });

    });

    describe ("asInheritence", function(){

        it ("does not distribute `additionalProperties`", function(){
            var merged = mergeJSONSchema (metaschema,
                {
                    properties:{ able:{ type:'string' } },
                    additionalProperties:{ type:'number' }
                },
                { properties:{ able:{}, baker:{ minimum:10 } } },
                true
            );
            assert.deepEqual (merged, {
                properties:{ able:{ type:'string' }, baker:{ minimum:10 } },
                additionalProperties:{ type:'number' }
            });
        });

        it ("replaces `additionalProperties` boolean false with schema", function(){
            var merged = mergeJSONSchema (metaschema,
                { additionalProperties:false },
                { additionalProperties:{ type:'number' } },
                true
            );
            assert.deepEqual (merged, { additionalProperties:{ type:'number' } });
        });

        it ("does not strip properties when additionalProperties=false", function(){
            var merged = mergeJSONSchema (metaschema,
                { properties:{ able:{ type:'number' } }, additionalProperties:false },
                { properties:{ able:{ minimum:10 }, baker:{ minimum:20 } } },
                true
            );
            assert.deepEqual (merged, {
                properties:{ able:{ type:'number', minimum:10 }, baker:{ minimum:20 } },
                additionalProperties:false
            });
        });

    });

});
