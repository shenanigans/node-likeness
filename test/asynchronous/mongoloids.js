
var Likeness = require ('../../Likeness');
var Mongo = require ('mongodb');
var TransformError = Likeness.errors.TransformError;
var assert = require ('assert');

var typeGetter = ({}).toString;
try { Buffer; } catch (err) { Buffer = function(){}; }
function getTypeStr (obj) {
    var tstr = typeGetter.apply(obj).slice(8,-1).toLowerCase();
    if (tstr == 'object')
        if (obj instanceof Buffer) return 'buffer';
        else return tstr;
    if (tstr == 'text') return 'textnode';
    if (tstr == 'comment') return 'commentnode';
    if (tstr.slice(0,4) == 'html') return 'element';
    return tstr;
}

function deepCompare (able, baker) {
    if (able === baker) return true;
    var type = getTypeStr (able);
    if (type != getTypeStr (baker)) return false;
    if (type == 'object' || type == 'array') {
        if (Object.keys (able).length != Object.keys (baker).length) return false;
        for (var key in able)
            if (!deepCompare (able[key], baker[key])) return false;
        return true;
    }
    if (
        type == 'regexp'
     && able.toString() == baker.toString()
     && able.global == baker.global
     && able.multiline == baker.multiline
    )
        return true;
    return able == baker;
}

var collection;
before (function (done) {
    this.timeout (500);
    var dbsrv = new Mongo.Server ('127.0.0.1', 27017);
    var db = new Mongo.Db (
        'test-likeness',
        dbsrv,
        { w:0 }
    );
    db.open (function (err) {
        if (err) {
            console.log ('could not connect to MongoDB at 127.0.0.1:27017');
            return process.exit (1);
        }
        db.collection ('test-likeness', function (err, col) {
            if (err) {
                console.log ('could not connect to MongoDB at 127.0.0.1:27017');
                return process.exit (1);
            }

            collection = col;
            collection.remove ({}, { w:1, fsync:true }, function (err) {
                if (err) {
                    console.log ('could not clear MongoDB test collection');
                    return process.exit (1);
                }
                done();
            });
        });
    });
});

var nextID = 1;
function getNextID(){ return 'tempID_sync_'+nextID++; }

function testMongoloid (schema, document, fragment, callback, empty) {
    var _id = document._id = getNextID();
    collection.insert (document, { w:1 }, function (err) {
        if (err) return callback (err);
        schema = new Likeness (schema);
        var mongoloid = {};
        var sync = true;
        try {
            schema.transform (fragment, document, mongoloid, function (err, result) {
                if (err) return callback (err);

                if (sync)
                    return callback (new Error ('callback fired synchronously'));
                if (!Object.keys (mongoloid).length) {
                    if (!empty) return callback (new Error (
                        'empty mongoloid update'
                    ));
                    return callback();
                }

                if (empty)
                    return callback (new Error ('mongoloid was supposed to be empty'));
                collection.update ({ _id:_id }, mongoloid, function (err) {
                    if (err) return callback (err);
                    collection.findOne ({ _id:_id }, function (err, mongoResult) {
                        if (err) return callback (err);
                        if (!deepCompare (result, mongoResult)) {
                            console.log (result);
                            return callback (new Error (
                                'mongoloid result did not match - '+JSON.stringify (mongoResult)
                            ));
                        }
                        callback();
                    });
                });
            });
        } catch (err) {
            return callback (new Error ('threw synchronous error - ' + JSON.stringify (err)));
        }
        sync = false;
    });
}

describe ("mongoloid updates", function(){
    this.timeout (150);

    describe ("simple (produces $set updates)", function(){

        it ("sets Strings on shallow paths with named children", function (done) {
            testMongoloid (
                {    // schema
                    able:   { '.type':'string' },
                    baker:  { '.type':'string' }
                },
                {    // document

                },
                {    // fragment
                    able:   'foo',
                    baker:  'bar'
                },
                done
            );
        });

        it ("sets Strings on shallow paths with named children and .all", function (done) {
            testMongoloid (
                {    // schema
                    able:   { '.type':'string' },
                    baker:  { '.type':'string' },
                    '.all': { '.type':'string', '.inject':[ [ 1, 'silver' ] ] }
                },
                {    // document

                },
                {    // fragment
                    able:   'foo',
                    baker:  'bar'
                },
                done
            );
        });

        it ("sets Strings on shallow paths with .arbitrary", function (done) {
            testMongoloid (
                {    // schema
                    '.arbitrary':   true
                },
                {    // document

                },
                {    // fragment
                    able:   'foo',
                    baker:  'bar'
                },
                done
            );
        });

        it ("sets Strings on shallow paths with .arbitrary and .all", function (done) {
            testMongoloid (
                {    // schema
                    '.arbitrary':   true,
                    '.all':         { '.type':'string' }
                },
                {    // document

                },
                {    // fragment
                    able:   'foo',
                    baker:  'bar'
                },
                done
            );
        });

        it ("sets Strings on shallow paths with .arbitrary and .all", function (done) {
            testMongoloid (
                {    // schema
                    '.arbitrary':   true
                },
                {    // document

                },
                {    // fragment
                    able:   'foo',
                    baker:  'bar'
                },
                done
            );
        });

        it ("sets Strings on deep paths", function (done) {
            testMongoloid (
                {    // schema
                    '.arbitrary':   true
                },
                {    // document

                },
                {    // fragment
                    able:   {
                        able:   'foo',
                        baker:  'bar'
                    },
                    baker:  {
                        able:   'foo',
                        baker:  'bar'
                    }
                },
                done
            );
        });

        it ("sets Numbers on shallow paths", function (done) {
            testMongoloid (
                {    // schema
                    '.arbitrary':   true
                },
                {    // document

                },
                {    // fragment
                    able:   9001,
                    baker:  42
                },
                done
            );
        });

        it ("sets Numbers on deep paths", function (done) {
            testMongoloid (
                {    // schema
                    '.arbitrary':   true
                },
                {    // document

                },
                {    // fragment
                    able:   {
                        able:   9001,
                        baker:  42
                    },
                    baker:  {
                        able:   9001,
                        baker:  42
                    }
                },
                done
            );
        });

        it ("does not set plain Object structures", function (done) {
            testMongoloid (
                {    // schema
                    '.arbitrary':   true
                },
                {    // document
                    able:{ baker:{ able:{ charlie:9001 }}},
                    baker:{ able:{ baker:{ charlie:9001 }}},
                },
                {    // fragment
                    able:   {
                        able:   {
                            able:   {
                                able:   {},
                                baker:  {}
                            },
                            baker:  {
                                able:   {},
                                baker:  {}
                            }
                        },
                        baker:  {
                            able:   {
                                able:   {},
                                baker:  {}
                            },
                            baker:  {
                                able:   {},
                                baker:  {}
                            }
                        }
                    },
                    baker:  {
                        able:   {
                            able:   {
                                able:   {},
                                baker:  {}
                            },
                            baker:  {
                                able:   {},
                                baker:  {}
                            }
                        },
                        baker:  {
                            able:   {
                                able:   {},
                                baker:  {}
                            },
                            baker:  {
                                able:   {},
                                baker:  {}
                            }
                        }
                    }
                },
                done,
                true // should produce an empty mongoloid
            );
        });

        it ("sets novel Arrays", function (done) {
            testMongoloid (
                {    // schema
                    '.arbitrary':   true
                },
                {    // document

                },
                {    // fragment
                    able:   [ 0, 1, 2, 3 ],
                    baker:  [ { able: [ 0, 1, 2, 3 ] } ]
                },
                done
            );
        });

    });

    describe ("math updates", function(){

        it ("adds", function (done) {
            testMongoloid (
                {    // schema
                    able:   { '.type':'number', '.add':true }
                },
                {    // document
                    able:   10
                },
                {    // fragment
                    able:   5
                },
                done
            );
        });

        it ("subtracts", function (done) {
            testMongoloid (
                {    // schema
                    able:   { '.type':'number', '.subtract':true }
                },
                {    // document
                    able:   10
                },
                {    // fragment
                    able:   5
                },
                done
            );
        });

        it ("multiplies", function (done) {
            testMongoloid (
                {    // schema
                    able:   { '.type':'number', '.multiply':true }
                },
                {    // document
                    able:   10
                },
                {    // fragment
                    able:   5
                },
                done
            );
        });

        it ("divides", function (done) {
            testMongoloid (
                {    // schema
                    able:   { '.type':'number', '.divide':true }
                },
                {    // document
                    able:   10
                },
                {    // fragment
                    able:   5
                },
                done
            );
        });

    });

    describe ("array updates", function(){

        it ("appends an element", function (done) {
            testMongoloid (
                {    // schema
                    able:       {
                        '.type':    'array',
                        '.append':  true
                    }
                },
                {    // document
                    able:       [ 0, 1, 2, 3 ]
                },
                {    // fragment
                    able:       [ 9 ]
                },
                done
            );
        });

        it ("appends multiple elements", function (done) {
            testMongoloid (
                {    // schema
                    able:       {
                        '.type':    'array',
                        '.append':  true
                    }
                },
                {    // document
                    able:       [ 0, 1, 2, 3 ]
                },
                {    // fragment
                    able:       [ 9, 9, 9 ]
                },
                done
            );
        });

        it ("prepends an element", function (done) {
            testMongoloid (
                {    // schema
                    able:       {
                        '.type':    'array',
                        '.prepend': true
                    }
                },
                {    // document
                    able:       [ 0, 1, 2, 3 ]
                },
                {    // fragment
                    able:       [ 9 ]
                },
                done
            );
        });

        it ("prepends multiple elements", function (done) {
            testMongoloid (
                {    // schema
                    able:       {
                        '.type':    'array',
                        '.prepend': true
                    }
                },
                {    // document
                    able:       [ 0, 1, 2, 3 ]
                },
                {    // fragment
                    able:       [ 9, 9, 9 ]
                },
                done
            );
        });

        it ("inserts an element at an index", function (done) {
            testMongoloid (
                {    // schema
                    able:       {
                        '.type':    'array',
                        '.insert':  2
                    }
                },
                {    // document
                    able:       [ 0, 1, 2, 3 ]
                },
                {    // fragment
                    able:       [ 9 ]
                },
                done
            );
        });

        it ("inserts multiple elements at an index", function (done) {
            testMongoloid (
                {    // schema
                    able:       {
                        '.type':    'array',
                        '.insert':  2
                    }
                },
                {    // document
                    able:       [ 0, 1, 2, 3 ]
                },
                {    // fragment
                    able:       [ 9, 9, 9 ]
                },
                done
            );
        });

        it ("properly updates a complex Array $set operation", function (done) {
            testMongoloid (
                {    // schema
                    able:       { '.type':'array', '.all':{ '.add':true }, '.sequence':[
                        { '.multiply':true },
                        { '.multiply':true },
                        { '.multiply':true },
                        { '.multiply':true }
                    ] }
                },
                {    // fragment
                    able:       [ 10, 20, 30, 40 ]
                },
                {    // document
                    able:       [ 10, 10, 10, 10 ]
                },
                done
            );
        });

    });

    describe (".sort", function(){



    });

    describe (".clip", function(){

        it ("reserves the first elements of an Array", function (done) {
            testMongoloid (
                {    // schema
                    able:       {
                        '.type':    'array',
                        '.append':  true,
                        '.clip':   7
                    }
                },
                {    // document
                    able:       [ 0, 1, 2, 3, 4, 5 ]
                },
                {    // fragment
                    able:       [ 9, 9, 9, 9 ]
                },
                done
            );
        });

        it ("reserves the last elements of an Array", function (done) {
            testMongoloid (
                {    // schema
                    able:       {
                        '.type':    'array',
                        '.append':  true,
                        '.clip':   -7
                    }
                },
                {    // document
                    able:       [ 0, 1, 2, 3, 4, 5 ]
                },
                {    // fragment
                    able:       [ 9, 9, 9, 9 ]
                },
                done
            );
        });

    });

});
