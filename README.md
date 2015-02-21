likeness
========
Simple JSON schema validation and transformations.


Installation
------------
```shell
$ npm install likeness
```
```javascript
var Likeness = require ('likeness');
var schema = new Likeness ({
    '.type':  'object',
    name:     { '.type':'string', '.match':/^[\w\s]+$/ }
});
var isValid = schema.validate ({ name:'schema information document' });
```


Basic Usage
-----------
###Validations
```javascript
var Likeness = require ('likeness');
var testHuman = {
    name:   "Chris Handsome",
    tags:   [ "admin", "presenter" ]
};

var schema = new Likeness ({
    name:     { ".type":"string", ".match":/^[\w\s]+$/ },
    tags:     { ".type":"array", ".all":{ ".match":/^[\w]+$/ } }
});
var adminCheckSchema = new Likness ({
    tags:   { ".exists":{ ".value":"admin" } }
});

try {
    // these will both validate
    schema.validate (testHuman);
    adminCheckSchema.validate (testHuman);
} catch (err) {  }
```

###Transforms
```javascript
// not ready for primetime
```

###MongoDB Transforms
```javascript
// ready when transforms are ready
```


Schema Definitions
------------------
The most common way to specify a `likeness` schema is with a document composed of a descriptive
Object whose children are constraints and more descriptive Objects.
```javascript
// the empty schema matches any basic type
```

All constraint keys begin with a period. To specify a child whose name begins with a period, use
the `.children` constraint.
`".children":{ ".childName":...`


JSON Schema
-----------
Likeness supports the latest [JSON Schema Draft 4](http://json-schema.org/documentation.html)
specification. Expanded validation capabilities and transforms are available to JSON Schema users
by setting the `$schema` property to `http://json-schema.org/likeness`. This URL does not actually
exist - `likeness` just simulates it. When using transforms, the `$schema`
`http://json-schema.org/likeness/transform` should be used.

Local copies of the base metaschemata are used, as well as the standard schemata on the JSON Schema
site , i.e. `geo` and `card`. The Draft 4 metaschemata has been modified in the following ways:
 * Added `additionalProperties:{ $ref:'#' }` to allow rejection of invalid schemata
 * Added `format` and `$ref` to `properties` to make Draft 4 self-validate again.
 * Removed `definitions` from `properties` because it is not a reserved word.

Source supporting the `format` keyword borrows heavily from [jayschema]
(https://github.com/natesilva/jayschema/tree/master/lib/suites/draft-04). It has no support for the
undocumented "regex" value, so the Draft 4 metaschema is *still* technically invalid despite the
changes mentioned above.

`$ref` chasing occurs in advance. Remote references are resolved to produce a compiled document
which can validate and transform quickly. `$ref` has also been extended to implement inheritence.
This functionality is available regardless of the `$schema` setting.
```javascript
{
    definitions:{
        human: {
            fullName: {
                type: "string",
                minLength: 4,
                maxLength: 256
            },
            ssn: {
                type:  "string",
                match: "\d{3}-\d{2}-\d{4}"
            }
        }
    },
    properties:     {
        activeUser: {
            $ref: "#/definitions/human",
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
```

Inheritence is very intuitive. The primary gotcha is when using an array of schemata with `items`.
Schemata from `items` and `additionalItems` on the parent and child are used to assemble an array of
schemata that mimics the result of validating the parent and child sequentially. It is possible for
an Error to be thrown during compilation if this array cannot be resolved.

###Conversion Methods
If your schema uses **any** references, it must be compiled. In order to compile, you must generate
a `JSContext` instance. This instance is a reusable caching object that can be used to compile
related batches of schemata. If you use `$ref` across schemata which cannot be found on the network,
you must either compile the batch in-order or call `submit` with each schema, then compile in any
order.

Note that when compiling a schema with no `id`, the schema is always mapped to
`http://json-schema.org/default#`.

```javascript
var likeness = require ('likeness');
var JSContext = likeness.helpers.JSContext;
var fromJSONSchema = likeness.helpers.fromJSONSchema;
var likeJSONSchema = likeness.helpers.likeJSONSChema;

var context = new JSContext();
async.series ([
    function (callback) {
        // anything we want to reference later should be submitted now
        context.submit (baseSchemaURL, baseSchema, callback);
    },
    function (callback) {
        // you may pass id as an argument. Overrides the root `id` property
        context.compile (schemaURL, schema, function (err, compiled) {
            // `compiled` can be converted to likeness-format
            fromJSONSchema (compiled, function (err, likeDef) {
                // now that we have a likeness-format schema document
                // we can create a likeness
                var like = new likeness (likeDef);
                try {
                    like.validate (myDocument);
                } catch (err) {
                    // myDocument wasn't, like, valid
                    return callback (err);
                }
                callback();
            });
        });
    },
    function (callback) {
        // to simply prepare one schema for validation
        // use this helper method
        likeness.helpers.likeJSONSChema (
            schema,
            function (err, like) {
                try {
                    like.validate (myDocument);
                } catch (err) {
                    // myDocument wasn't, like, valid
                    return callback (err);
                }
                callback();
            }
        );
    }
], function (err) {
    // we can keep using this context forever
    // unless we want to get fresh schemata from the network
});
```


LICENSE
-------
The MIT License (MIT)

Copyright (c) 2015 Kevin "Schmidty" Smith

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
