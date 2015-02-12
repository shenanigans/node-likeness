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
which can validate and transform quickly. There is a caveat - circular schema dependencies cannot be
resolved unless they are recursive.
```javascript
// valid JSON Schema, but cannot be used with likeness
{
    foo:{ inner:{ $ref:"#/bar" } },
    bar:{ inner:{ $ref:"#/foo" } }
}

// this one works with likeness
{ foo:{ properties:{ bar:{ $ref:'#' } } } }

// this one also works with likeness
{
    foo:{ inner:{ $ref:"#/bar" } },
    bar:{ inner:{ $ref:"#/bar" } }
}
```

`$ref` has also been extended to implement inheritence. This functionality is available regardless
of the `$schema` setting.
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
                var likeThis = new likeness (likeDef);
                callback();
            });
        });
    },
    function (callback) {
        // to simply prepare one schema for validation
        // use this helper method
        likeJSONSchema (schema, function (err, like) {
            try {
                like.validate (myDocument);
            } catch (err) {
                // there was, like, a problem with myDocument
            }
            callback();
        });
    }
], function (err) {
    // we can keep using this context forever
    // unless we want to get fresh schemata from the network
});
```


###Additional Notes
I do not recommend using JSON Schema, for a number of reasons.
 * The `id` property is too powerful. Abusively so.
 * The defaults, i.e. the schema produced by `{}`, make mistakes very easy. For example, the Draft 4 Metaschema is incomplete (it doesn't explain the `format` property, although it uses it) and invalid (it uses an undocumented value for the `format` property) yet nobody seems to have noticed.
 * Named properties do not preclude regex-matched property schema. They do in `likeness`. When a `matchProperties` child affects a named property, the child schema is pre-merged before creating the likeness instance in order to simulate this behavior
 * Properties should have first-order status, not subschemata. The syntax as designed has poor legibility.
 * The design is generally cluttered with features for hosting schemata online. Do you imagine this will let deployed copies of your application magically adapt to API changes? Why in the world would a validation schema be something you would need to dynamically load?
 * Adopting more specs from the IETF will only encourage them.


Operator List
-------------
###Validators
 * `.type`          restrict document type
 * `.adHoc`         accept unknown keys
 * `.arbitrary`
 * `.tolerant`      ignore unknown keys
 * `.optional`      accept `undefined` as a valid document
 * `.keyTest`
 * `.children`      optional - this is the escape strategy for special keys
 * `.min`           mininum value, length, or number of keys
 * `.max`           maximum value, length, or number of keys
 * `.exclusiveMin`  exclusive mininum value
 * `.exclusiveMax`  exclusive mininum value
 * `.modulo`        modulo
 * `.length`        exact length match
 * `.match`         regex value matching
 * `.eval`          call-the-function evaluation
 * `.async`         marks a `function` constraint as async
 * `.exists`        at least one key/value matches the given schema
 * `.times`         modifies `exists` constraint - requires [times] keys to match
 * `.all`           every key/value matches the given schema
 * `.value`         exact value match

###Transformers
 * `.cast`          convert strings to match .type
 * `.set`           hard overwrite
 * `.inject`        insert hard data into input and overwrite target
 * `.insert`        insert input into target at Array/String position
 * `.append`        append input to target Array/String
 * `.prepend`       prepend input to target Array/String
 * `.normal`        normalize Numbers
 * `.add`           add input number to target
 * `.subtract`      subtract input number from target
 * `.multiply`      multiply target number by input
 * `.divide`        divide target number by input
 * `.modulate`      modulo input before overwriting target
 * `.inverse`       multiply by -1 (works for booleans)
 * `.reciprocal`    1/x
 * `.split`         regex split
 * `.group`         regex exec -> Array of groups
 * `.case`          transform string capitalization
 * `.transform`
 * `.filter`        pass key/index and value to function for selective drop
 * `.rename`        rename a key
 * `.drop`          drop a key
 * `.clip`          restrict max length


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
