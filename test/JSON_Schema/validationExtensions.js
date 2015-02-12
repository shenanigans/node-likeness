
var async = require ('async');
var likeness = require ('../../likeness');

function testValidate (document, schema, isValid, callback) {
    var context = new likeness.helpers.JSContext();
    context.compile ('https://foo.bar.com/test-schema', schema, function (err, compiled) {
        if (err) return callback (err);
        likeness.helpers.fromJSONSchema (compiled, function (err, likeDoc) {
            if (err) return callback (err);

            // console.log ('fromJSONSchema', likeDoc);

            var likeInstance = new likeness (likeDoc);

            try {
                likeInstance.validate (document);
                if (!isValid)
                    return process.nextTick (function(){
                        callback (new Error ('failed to reject the document (sync)'));
                    });
            } catch (err) {
                if (isValid)
                    return callback (new Error ('failed to pass the document (sync)'));
            }

            try {
                var alive = true;
                return likeInstance.validate (document, function (err) {
                    if (err) {
                        if (isValid)
                            return callback (new Error ('failed to pass the document (async)'));
                    } else if (!isValid)
                        return callback (new Error ('failed to reject the document (async)'));

                    // final pass
                    callback();
                });
            } catch (err) {
                return callback (new Error ('async validation synchronously threw an Error'));
            }
        });
    });
}

describe ("validate (likeness extensions)", function(){

    describe ("objects", function(){

        it ("accepts the document with .keyFormat", function (done) {
            testValidate (
                {
                    'very.common@example.com':                          9001,
                    'a.little.lengthy.but.fine@dept.example.com':       9002,
                    'disposable.style.email.with+symbol@example.com':   9003
                },
                {
                    keyFormat:'email'
                },
                true,
                done
            );
        });

    });

    describe ("forEach constraints", function(){

    });

});
