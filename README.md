likeness
========
A JSON perturbance engine in [Node.js](http://nodejs.org/). Precompile JSON Schemata, validate and
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

**[Transform Constraints](#transform-constraints)**
 * [Meta-Transforms](#meta-transforms)
 * [Universal Transforms](#universal-transforms)
 * [Object Transforms](#object-transforms)
 * [Array Transforms](#array-transforms)
 * [Object and Array Transforms](#object-and-array-transforms)
 * [String Transforms](#string-transforms)
 * [Number Transforms](#number-transforms)
 * [Conversion Transforms](#conversion-transforms)

**[JSON Schema Extensions](#json-schema-extensions)**

`likeness` is developed and maintained by Kevin "Schmidty" Smith under the MIT license. If you're
excited about it, please consider [giving me some money.](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=PN6C2AZTS2FP8&lc=US&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donate_SM%2egif%3aNonHosted)
I could really use it.

I am also interested in job opportunities; just [open an issue](https://github.com/shenanigans/node-likeness/issues/new)
and I'll get back to you.


Getting Started
---------------
###Installation
```shell
$ npm install likeness
```

###Basic Use
```javascript
var likeness = require ('likeness');
var schema = new likeness ({
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
            '.mean':         true
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
* **.minVals** (synonyms: `.minValues`, `.minItems`) The minimum number of items that must appear in an Array.
* **.maxVals** (synonyms: `.maxValues`, `.maxItems`) The maximum number of items that must appear in an Array.
* **.valCount** (synonyms: `.vals`, `.values`, `.itemCount`, '.items')  The exact number of items that must appear in an Array.
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
When using `.or` or `.xor`, transforms are honored only on the schema chosen to apply.

####Universal Transforms
* **.set** Ignores the input value and replaces the target with a clone of this reference. The reference is required to be JSON-serializable. It is safely duplicated so you may use complex documents here without introducing state to your schema.
* **.default** When the input value is missing (undefined), replaces the target with a clone of this reference. The reference is required to be JSON-serializable. It is safely duplicated so you may use complex documents here without introducing state to your schema.

####Accumulators
Look up content from the source document to produce a generated value. Accumulators use absolute
paths and are therefor not portable. Path traversal is parallelized whenever an Array is encountered,
similar to MongoDB. As an example, in the following document, the path 'foo/bar/baz' selects four
values: `[ 1, 2, 3, 4 ]`
```javascript
{
    foo:    [
        {
            bar:    [
                { baz:1 },
                { baz:2 }
            ]
        },
        {
            bar:    [
                { baz:3 },
                { baz:4 }
            ]
        }
    ],
}
```

* **.fill** Selects zero or more values from the input and applies the local transform to each value sequentially.
* **.list** Fills an Array with zero or more values from the input and applies the local transform to the new Array.
* **.group** After acquiring an Array of values from `.fill` or `.list`, generate a "key" by applying a transform to each value, then "group" values that generate the same "key". The output is an Array of Arrays of values.
* **.groupTransform** Modifies a `.group` constraint. After "group" Arrays are generated, each Array is passed to a transform schema and replaced with the output value. Accumulators inside a `.groupTransform` will not be rooted to the document, but to the group, i.e. applying `.list:"B"` to the group `[ { A:1, B:3 }, { A:1, B:7 } ]` produces `[ 3, 7 ]` no matter where in the document the whole operation occurs.

####Object Transforms
* **.tolerant** When properties in the input value do not match any child schema, ignore them.
* **.newKeys** If a property in the source is already found in the target, ignore it.
* **.rename** When a property is found in the source value, rename it. Declared as `{ originalName: newName }`
* **.drop** When a property is found on the source, ignore it. Declared as an array of key names.

####Array Transforms
* **.insert** Splices the source Array's items into the target at the specified index. Negative indices are supported.
* **.append** Append the source Array's items to the target.
* **.prepend** Prepend the source Array's items to the target.

####Object and Array Transforms
When using `.exists`, only validations are used and transforms are not applied. With `.all`
transforms are applied to every item or property of the Array or Object.

* **.inject** Insert reference clones into the input, overwriting properties on Objects and splicing into Arrays. Declared as `[ [ 10, "injectValue" ], [ "appendValue ], ...]` or `[ [ "key", "value"], ...]`. Injected references must be JSON-serializable. Complex references will be safely duplicated each time.
* **.clip** Retains the first (positive Number) or last (negative Number) items or properties on the Array or Object. With Objects, properties are retained according to the order in which they were first defined.
* **.filter** Apply a schema to every item or property of the Array or Object, quietly dropping every item or property that does not validate.

####String Transforms
* **.case** convert a String to upper or lower case. Declared as `"upper"` or `"lower"`.
* **.inject** Insert Strings into the input String, overwriting properties on Objects and splicing into Arrays. Declared as `[ [ 10, "injectValue" ], [ "appendValue ], ...]` or `[ [ "key", "value"], ...]`. Injected references must be JSON-serializable. Complex references will be safely duplicated each time.

####Number Transforms
* **.normal**
* **.normalize** (synonyms: `.normal`, `.normalization`) Divide the input value by a specified Number. If you instantiate a new `likeness` with a Number as the schema definition, you get a `.normalize` constraint.
* **.add** Add the input value to the target.
* **.subtract** Subtract the input value from the target.
* **.multiply** Multiply the input value with the target.
* **.divide** Divide the target by the input value.
* **.average** Smooth the input and target values by adding the difference multiplied by a coefficient. By default (declare `.average:true`) the coefficient is 0.5 just like the normal average of two numbers. Declare a Number between 0 and 1 to prefer the target or source value. Number above 1 are divided instead of multiplied, with Numbers above 2 prefering the target over the source.
* **.modulate** (synonyms: `.modFilter`) Perform the modulo operation on the input value with a given divisor.
* **.invert** (synonyms: `.inverse) Multiply by -1.
* **.reciprocal** Replace the input value with 1 divided by the input value.

####Conversion Transforms
These Transforms may not output the same type they input.
* **.total** Convert the input Array into a Number by adding Number items together. Fails if a non-Number item is encountered. This constraint occurs **before** the `.type` constraint, so if the schema path is typed it should be a Number, not an Array.
* **.mean** Convert the input Array into a Number by adding Number items together and dividing by length. Fails if a non-Number item is encountered. This constraint occurs **before** the `.type` constraint, so if the schema path is typed it should be a Number, not an Array.
* **.transform** (synonyms: `.function`) Calls a Function passing the target and source values as arguments and replaces the target with the Function's return value. Note that `.transform` occurs **before** type enforcement. There is no type guarantee for the input, but the returned value is tested by all other constraints, including `.type`.
* **.cast** Converts Strings to other types (or String again) by parsing as JSON. Applied after `.transform` and may be used to convert its output.
* **.asItem** (synonyms: `.asElem`) Converts the input value to an Array containing the input value.
* **.getYear** attempt to load the input value as a date, shift the date to the start of the date's year and output an epoch timestamp (UTC) in integer milliseconds.
* **.getYearName** attempt to load the input value as a date and get a String of the current year.
* **.getMonth** attempt to load the input value as a date, shift the date to the start of the date's month, and output an epoch timestamp (UTC) in integer milliseconds.
* **.getMonthName** attempt to load the input value as a dateand get a lowercase String of the month's name i.e. "july"
* **.getDay** attempt to load the input value as a date, shift the date to the start of the date's day, and output an epoch timestamp (UTC) in integer milliseconds.
* **.getDayNum** attempt to load the input value as a date and get a Number for a date's day of the month
* **.getDayName** attempt to load the input value as a date and get a lowercase String for a date's day of the week i.e. "friday"


JSON Schema Extensions
----------------------
You can usually use any constraint or transform in extended JSON Schema simply by using canonical
names (not synonyms) and ommiting the leading periods. The following exceptions apply:
 * **forAll** `.all`
 * **thereExists** `.exists`
 * **uniqueProperties** `.unique`
 * **uniqueItems** `.unique`


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
