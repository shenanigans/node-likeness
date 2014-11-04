likeness
========

Simple JSON schema validation and transformations.

*transformations not yet implemented*


Installation
------------
```shell
$ npm install likeness
```


Usage
-----
```javascript
var Likeness = require ('likeness');
var schema = new Likeness ({
    '.type':  'object',
    name:     { '.type':'string', '.match':/^[\w\s]+$/ }
});
var isValid = schema.validate ({ name:'schema information document' });
```

Hints
-----
Consider the following:
```javascript
var schema = new Likeness ({
    '.arbitrary':   true,
    '.forAll':      {
        uniqueID:       { '.type':'string' },
        typeStr:        /\w+(?:\/\w+)*/, // slash-delimited words
        verified:       true
    }
});
```
