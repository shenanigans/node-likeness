likeness
========
A JSON perturbence engine in [Node.js](http://nodejs.org/). Precompile JSON Schemata, validate and
query documents, generate, compute, update and transform data, non-destructively and reproducibly.
An alternate schema definition language and extensions to JSON Schema Draft 4.


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
    '.default': {},
    points:     {
        '.type':    'array',
        '.append':  true,
        '.all':     {
            x:          {
                '.type':    'number',
                '.gte':     0
            },
            y:          {
                '.type':    'number',
                '.gte':     0
            }
        },
        '.sort':    { x:1 }
    },
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
var report = likeMakeReport.transform (dataset);
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
                '.groupTrasnform': {
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
exist - `likeness` just simulates it. When using transforms, the `$schema`
`http://json-schema.org/likeness/transform` should be used.

Local copies of the base metaschemata are used, as well as the standard schemata on the JSON Schema
site , i.e. `geo` and `card`. The Draft 4 metaschemata has been modified in the following ways:
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
