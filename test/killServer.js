
var needle = require ('needle');
needle.get ('127.0.0.1:9999/shutdown', function (err, response) {
    if (err)
        console.log (err);
});
