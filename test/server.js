
var express = require ('express');
var app = express();
app.use (express.static ('test/remote'));

app.get ('/shutdown', function (req, res) {
    res.end();
    process.exit();
});

app.listen (9999, function (err) {
    // ready
});
