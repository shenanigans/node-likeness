
var http = require ('http');

function callServer(){
    var request = http.get ('http://127.0.0.1:9999/simple.json', function (res) {
        process.exit();
    });
    request.on ('error', function(){ process.exit (1); });
}

setTimeout (function reaper(){
    callServer();
    setTimeout (reaper, 100);
}, 100);

callServer();
