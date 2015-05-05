likeness
========
A JSON perturbence engine in [Node.js](http://nodejs.org/). Precompile JSON Schemata, validate and
query documents, generate, compute, update and transform data, non-destructively and reproducibly.
An alternate schema definition language and extensions to JSON Schema Draft 4.

####TOC
**[Getting Started](#getting-started)**
**[Examples](#examples)**
 * [Validations](#validations)
 * [Transforms](#transforms)
**[JSON Schema](#json-schema)**
 * [Using JSON Schema](#using-json-schema)
**[Validation Constraints](#validation-constraints)**
 * [Markup Constraints](#markup-constraints)
 * [Meta-Constraints](#meta-constraints)
 * [Universal Constraints](#universal-constraints)
 * [Object Constraints](#object-constraints)
 * [Array Constraints](#array-constraints)
 * [Object and Array Constraints](#object-and-array-constraints)
 * [String Constraints](#string-constraints)
 * [Number Constraints](#number-constraints)
**[Transform Constraints](transform-constraints)**
 * [Meta-Transforms](#meta-transforms)
 * [Universal Transforms](#universal-transforms)
 * [Object Transforms](#object-transforms)
 * [Array Transforms](#array-transforms)
 * [Object and Array Transforms](#object-and-array-transforms)
 * [String Transforms](#string-transforms)
 * [Number Transforms](#number-transforms)


Getting Started
---------------
###Installation
```shell
$ npm install likeness
```

###Basic Use
```javascript
var Likeness = require ('likeness');
var schema = new Likeness ({
    '.type':  'object',
    name:     { '.type':'string', '.match':/^[\w\s]+$/ }
});
try {
    schema.validate ({ name:'schema information document' });
} catch (err) { }
```


Examples
--------
###Validations
```javascript
var likeness = require ('likeness');
var testHuman = {
    name:   "Chris Handsome",
    tags:   [ "admin", "presenter" ]
};

var likeAreTheyHuman = new likeness ({
    name:       {
        ".type":    "string",
        ".match":   /^[\w\s]+$/
    },
    tags:       {
        ".type":    "array",
        ".all":     {
            ".match":   /^[\w]+$/
        }
    }
});
var likeAreTheyAdmin = new likeness ({
    ".arbitrary":   true,
    tags:           {
        ".type":        "array",
        ".exists":      {
            ".value":       "admin"
        }
    }
});

try {
    // these will both validate
    likeAreTheyHuman.validate (testHuman);
    likeAreTheyAdmin.validate (testHuman);
} catch (err) {  }
```

###Transforms
This first example prepares a basic report for a set of data points. The accumulator `.fill` is used
to fetch values from the source document. Note that only the pre-transform source is available to an
accumulator, so one schema can **not** be used to add data points to the document and recalculate
the regression in the same step.

```javascript
var dataset = { points:[
    { x:0, y:10.54789023 },
    { x:1, y:12.48943548 },
    { x:2, y:14.38518564 },
    { x:3, y:16.47562165 },
    { x:4, y:18.78965435 }
] };

var likeness = require ('likeness');
var likeMakeReport = new likeness ({
    '.tolerant': true,
    regression: {
        // y = ( m * x ) + b
        m:          { '.type':'number' },
        b:          { '.type':'number' },
        '.fill':    'points',
        '.transform': function (values) {
            var points = values.map (function(p){
                return [ p.x, p.y ];
            });
            var regression = doRegression (points);
            return {
                m:      regression.coefficient,
                b:      regression.constant
            }
        }
    }
});

try {
    var report = likeMakeReport.transform (dataset);
} catch (err) {
    // if doRegression produces a bad value,
    // the schema will catch it and throw a message
}
```

For another example, here is a simple monthly budget tracker used to generate an average monthly
budget.
```javascript
var BudgetHistory = {
    expenses:       [
        {
            amount: 2500.00,
            type:   'rent',
            time:   new Date (2014, 6, 3).getTime()
        },
        {
            amount: 272.03,
            type:   'grocery',
            time:   new Date (2014, 6, 17).getTime()
        },
        {
            amount: 2500.00,
            type:   'rent',
            time:   new Date (2014, 7, 3).getTime()
        },
        {
            amount: 244.91,
            type:   'grocery',
            time:   new Date (2014, 7, 13).getTime()
        },
        {
            amount: 2500.00,
            type:   'rent',
            time:   new Date (2014, 8, 3).getTime()
        },
        {
            amount: 301.21,
            type:   'grocery',
            time:   new Date (2014, 8, 14).getTime()
        }
    ],
    income:         {
        paycheques:     [
            {
                amount: 3051.48,
                time:   new Date (2014, 6, 1).getTime()
            },
            {
                amount: 2998.75,
                time:   new Date (2014, 7, 1).getTime()
            },
            {
                amount: 3100.51,
                time:   new Date (2014, 8, 1).getTime()
            }
        ],
        other:          [
            {
                amount: 50.00,
                type:   'gambling',
                time:   new Date (2014, 8, 21).getTime()
            }
        ]
    }
};

var likeness = require ('likeness');
var likeMakeBudgetReport = new likeness ({
    '.tolerant':    true,
    monthlyAverages: {
        '.default':     {},
        income:         {
            '.mean:         true
            '.fill':        {
                '.fill':        [
                    'income/paycheques',
                    'income/other'
                ],
                '.group':       {
                    '.fill':        'time',
                    '.getMonth':    true,
                },
                '.groupTransform': {
                    '.fill':        'amount',
                    '.add':         true
                }
            },
        },
        expenses:       {
            '.mean:         true
            '.fill':        {
                '.fill':        'expenses',
                '.group':       {
                    '.fill':        'time',
                    '.getMonth':    true,
                },
                '.groupTransform': {
                    '.fill':        'amount',
                    '.add':         true
                }
            }
        }
    }
});

var budgetReport = likeMakeBudgetReport
    .transform (Budget, JuneBudget)
    ;
```


JSON Schema
-----------
Likeness supports the latest [JSON Schema Draft 4](http://json-schema.org/documentation.html)
specification. Expanded validation capabilities and transforms are available to JSON Schema users
by setting the `$schema` property to `http://json-schema.org/likeness`. This URL does not actually
exist, `likeness` just simulates it. When transforms are desired, use `$schema:"http://json-schema.org/likeness/transform"`.

Local copies of the base metaschemata are used, as well as the standard schemata on the JSON Schema
site , i.e. `geo` and `card`. The Draft 4 metaschema has been modified in the following ways:
 * Added `additionalProperties:{ $ref:'#' }` to enable rejection of invalid schemata
 * Added `format` and `$ref` to `properties` to make Draft 4 self-validate.
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

###Using JSON Schema
If your schema uses **any** references, it must be compiled. In order to compile, you must generate
a `JSContext` instance. This instance is a reusable caching Object that can be used to compile
related batches of schemata. If you use `$ref` across schemata which cannot be found on the network,
you must either compile the batch in-order or call `submit` with each schema, then compile in any
order.

Note that when compiling a schema with no `id`, `likeness` will pretend that the schema is bound to
the phony url `http://json-schema.org/default#`.
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
        // you may pass id as the first argument.
        // if you also specified an `id` property, it is overridden
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
    // unless we want to refresh schemata from the network
});
```


Validation Constraints
----------------------
####Markup Constraints
* **.title** A non-op reserved word required to support JSON Schema.
* **.description** A non-op reserved word required to support JSON Schema.
* **.error** When a document fails to validate here or within a deeper child, this value is thrown. The most proximate `.error` is used. Note that the same reference is always thrown, so if you choose to throw an Object or Array it will be shared and potentially make your schema stateful.

####Meta-Constraints
Constrain by permutations of other schema.
* **.or** (synonyms: `.anyOf`) match first among an Array of schema
* **.xor** (synonyms: `.oneOf`, `.exactlyOne`)  match exactly one among an Array of schema
* **.not** must not match schema

####Universal Constraints
* **.type** restrict document type
* **.adHoc** (synonyms: `.arbitrary`) accept unknown keys
* **.optional** accept `undefined` as a valid document
* **.invalid** if traversed, the document is always invalid
* **.value** a JSON-compatible reference which is compared for exact equality against the input.
* **.anyValue** a list of JSON-compatible references which are compared for exact equality against the input.
* **.recurse** declared as a Number. Navigate up as many levels and apply this parent schema to the input value. Normal `likeness` schemata are tolerant of circular references but JSON Schemata must be valid JSON Documents. Precompilation eliminates every non-recursive `$ref` and the `.recurse` constraint tackles the rest.
* **.eval** (synonyms: `.evaluate`) calls a Function with the value as the first (and only) argument and fails to validate if the Function throws anything.

####Object Constraints
* **.dependencies** schema or name requirements triggered by other keys, as `{ source:[ 'dependeny', 'keys' ], ...}`
* **.unique** all properties or items must be unique values. Intelligently compares complex values for uniqueness.
* **.key** (synonyms: `.keyTest`) test property key names against a schema.
* **.children** (synonyms: `.child`, `.props`, `.properties`) explicitly declare child properties when reserved words are used as keys, or whenever you feel like it.
* **.matchChildren** (synonyms: `.matchChild`) apply a schema to properties when their keys match a regular expression. Specify either as a `String` or a `RegExp`.
* **.minKeys** (synonyms: `.minProps`, `.minProperties`) The minimum number of properties that must appear in an Object.
* **.maxKeys** (synonyms: `.maxProps`, `.maxProperties`) The maximum number of properties that must appear in an Object.
* **.keyCount** (synonyms: `.keys`, `.propCount`, `.propertyCount`) The exact number of properties that must appear in an Object.
* **.keyFormat** requires that all property keys on this Object be of a format compatible with one of the [JSON Schema String formats](http://json-schema.org/latest/json-schema-validation.html#anchor107).

####Array Constraints
* **minVals** (synonyms: `.minValues`, `.minItems`) The minimum number of items that must appear in an Array.
* **maxVals** (synonyms: `.maxValues`, `.maxItems`) The maximum number of items that must appear in an Array.
* **valCount** (synonyms: `.vals`, `.values`, `.itemCount`, '.items')  The exact number of items that must appear in an Array.
* **.sort** Require that items be an a particular order. This one doubles as a Transform; when Transforming, items are *forced* to be in a particular order. Sort specifications are [just like in MongoDB](http://docs.mongodb.org/manual/reference/operator/update/sort/#up._S_sort) except the path delimiter is slash instead of period.

####Object and Array Constraints
* **.exists** (synonyms: `.thereExists`) Requires that one (or more, see `.times`) items or properties on this Array or Object validate against one or more schema. Declare as either a schema or Array of schemata.
* **.times** When used in the child schema of an `.exists` constraint, requires that the `.exists` constraint succeed the specified number of times.
* **.all** (synonyms: `.forAll`, `.every`, `.forEvery`) Apply a schema to every item or property on this Array or Object.
* **.extras** (synonyms: `.extra`) The guaranteed last option. If no other subschema applies to an item or property of this Array or Object, this subschema is applied.
* **.sequence** an Array of schema which are applied to items of the input value sequentially. When `.sequence` is declared but neither `.all` nor `.extras` are, the input Array and schemata sequence must have equal length.

####String Constraints
* **.minLength** Minimum String length.
* **.maxLength** Maximum String length.
* **.length** (synonyms: `.len`) Exact String length.
* **.match** (synonyms: `.regex`, `.regexp`) Validates only if a given regular expression matches the input String at least once. Declare as either a String or RegExp.
* **.format** requires that the String be of a format compatible with one of the [JSON Schema String formats](http://json-schema.org/latest/json-schema-validation.html#anchor107)

####Number Constraints
* **.gt** (synonyms: `.greaterThan`, `.>`)
* **.gte** (synonyms: `.greaterOrEqual`, `.>=`)
* **.lt** (synonyms: `.lessThan`, `.<`)
* **.lte** (synonyms: `.lessOrEqual`, `.<=`)
* **.modulo** (synonyms: `.mod`, `.%`) Require a given modulo result, where `remainder = value % divisor` is expressed as `.modulo:[ divisor, remainder ]`.
* **.multiple** Requires that the input be a round multiple of a number. Unlike using `.modulo` with a zero remainder, neither the input value nor specified coefficient are treated as integers.


Transform Constraints
---------------------
####Meta-Transforms

####Universal Transforms

####Object Transforms

####Array Transforms

####Object and Array Transforms

####String Transforms

####Number Transforms


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
