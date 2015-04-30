likeness
========
A Javascript


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

For another example, here is a simple monthly budget tracker used to merge a month's expenses into
an overall budget history. The calculated values are applied with the transform `".average":5` which
is a simple smoothing function. The target value is incremeneted by the difference between the
source and target divided by five. (If a value lower than 1 is supplied, the difference is
multiplied instead. Get a standard average with any of the following: `".average":true`,
`".average":2`, or `".average":0.5`.)
```javascript
var Budget = {
    expenses:       [
        {
            amount:         2500.00,
            type:           'rent',
            time:           '2014-5-15'
        },
        {
            amount:         24.99,
            type:           'grocery',
            description:    'beer',
            time:           '2014-5-15'
        }
    ],
    income:         {
        paycheques:     [
            {
                amount:         3145.72,
                time:           '2014-3-1'
            },
            {
                amount:         3009.17,
                time:           '2014-4-1'
            },
            {
                amount:         3050.89,
                time:           '2014-5-1'
            }
        ],
        other:          [
            {
                amount:         1500.00,
                type:           'contract',
                time:           '1995-1-25'
            }
        ]
    },
    monthly:    {
        income:     3068.59,
        expenses:   2524.99
    }
};

var JuneBudget = {
    expenses:       [
        {
            amount:         172.03,
            type:           'grocery',
            time:           '2014-6-3'
        },
        {
            amount:         158.88,
            type:           'grocery',
            time:           '2014-6-10'
        },
        {
            amount:         2500.00,
            type:           'rent',
            time:           '2014-6-15'
        },
        {
            amount:         204.16,
            type:           'grocery',
            time:           '2014-6-17'
        },
        {
            amount:         160.33,
            type:           'grocery',
            time:           '2014-6-24'
        },
        {
            amount:         39.99,
            type:           'entertainment',
            description:    'Deathkiller 7 Pre-Order',
            time:           '2014-6-19'
        }
    ],
    income:         {
        paycheques:     [
            {
                amount:         3051.48,
                time:           '2014-6-1'
            }
        ],
        other:          [
            {
                amount:         50.00,
                type:           'gambling',
                time:           '2014-6-17'
            }
        ]
    }
};

var likeness = require ('likeness');
var likeUpdateBudget = new likeness ({
    expenses:       {
        '.type':        'array',
        '.all':         {
            amount:         { '.type':'number', '.gt':0 },
            type:           { '.type':'string', '.lt':128 },
            description:    { '.type':'string', '.optional':true },
            time:           { '.type':'string', '.format':'date-time' }
        },
        '.append':      true
    },
    income:         {
        paycheques:     {
            '.type':        'array',
            '.all':         {
                amount:         { '.type':'number', '.gt':0 },
                description:    { '.type':'string', '.optional':true },
                time:           { '.type':'string', '.format':'date-time' }
            },
            '.append':      true
        },
        other:          {
            '.type':        'array',
            '.all':         {
                amount:         { '.type':'number', '.gt':0 },
                type:           { '.type':'string', '.lt':128 },
                description:    { '.type':'string', '.optional':true },
                time:           { '.type':'string', '.format':'date-time' }
            },
            '.append':      true
        },
    },
    monthly:        {
        '.default':     {},
        income:         {
            '.fill':        {
                '.fill':        [
                    'income/paycheques/amount',
                    'income/other/amount'
                ],
                '.type':        'number',
                '.add':         true
            },
            '.average':     5
        },
        expenses:       {
            '.fill':        {
                '.fill':        'expenses/amount',
                '.type':        'number',
                '.add':         true
            },
            '.average':     5
        }
    }
});

likeUpdateBudget.transform (Budget, JuneBudget);
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
