
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
            collection.remove ({}, { w:1, multi:true }, function (err) {
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

function testMongoloid (schema, document, fragment, callback) {
    var _id = document._id = getNextID();
    collection.insert (document, { w:1 }, function (err) {
        if (err) return callback (err);
        schema = new Likeness (schema);
        var mongoloid = {};
        schema.transform (fragment, document, mongoloid);
        collection.update ({ _id:_id }, mongoloid, function (err) {
            if (err) return callback (err);
            collection.findOne ({ _id:_id }, function (err, mongoResult) {
                if (err) return callback (err);
                if (!deepCompare (document, mongoResult))
                    return callback (new Error (
                        'mongoloid result did not match - '+JSON.stringify (mongoResult)
                    ));

                callback();
            });
        });
    });
}

describe ("mongoloid updates", function(){

    describe ("$set", function(){
        it ("sets Strings on shallow paths to the database", function (done) {
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

        it ("sets plain Object structures", function (done) {
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
                done
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

    describe ("$math", function(){

        it ("adds");

        it ("subtracts");

        it ("multiplies");

        it ("divides");

    });

    describe ("$push", function(){

        it ("appends an element");

        it ("appends multiple elements");

        it ("prepends an element");

        it ("prepends multiple elements");

        it ("inserts an element at an index");

        it ("inserts multiple elements at an index");

    });

    describe ("$sort", function(){



    });

    describe ("$slice", function(){

        it ("reserves the first elements of an Array");

        it ("reserves the last elements of an Array");

        it ("reserves a middle slice of elements from an Array");

    });

});
