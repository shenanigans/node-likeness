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


JSON Schema
-----------
Likeness supports latest the [JSON Schema](http://json-schema.org/documentation.html) Draft 4
specification. Expanded validation capabilities and transforms are available to JSON Schema users
by setting the `$schema` property to `http://json-schema.org/likeness`. This URL does not actually
exist - `likeness` just simulates it.

Source supporting the `format` keyword borrows heavily from [jayschema]
(https://github.com/natesilva/jayschema/tree/master/lib/suites/draft-04).

`$ref` chasing occurs in advance. Remote references are resolved to produce a compiled document
which can validate and transform quickly. There is a caveat - circular schema cannot be resolved,
unless at least one link in the chain is recursive, i.e. it refers to a direct ancestor.
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
assert (schema.validate (testHuman));

var adminCheckSchema = new Likness ({
    tags:   { ".exists":{ ".value":"admin" } }
});
assert (adminCheckSchema.validate (testHuman));
```

###Transforms
```javascript
// not ready for primetime
```

###MongoDB Transforms
```javascript
// ready when transforms are ready
```


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

###Coming Soon
 *

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
