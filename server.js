var express = require('express')
    , app = express()
    , server = require("http").createServer(app) 
                app.use(express.static(__dirname + '/client'));

var ws = require("ws"),
    client = require("ar-drone").createClient();
    
client.config('video:video_channel', 0);

//TODO: rjesiti error kod refresanja stranice

var wsServer = new ws.Server({server: server});
console.log("websocket server created")
wsServer.on('connection', function(conn) {

    console.log('websocket connection open');
    function send(msg) {
        conn.send(JSON.stringify(msg));
    }
    var cameraMode = 0;
    conn.on('message', function(msg) {
        try {
            msg = JSON.parse(msg);
        } catch (err) {
            console.log('err: '+err+': '+msg);
        }
        var kind = msg.shift();
        switch (kind) {
             case 'on':
                var event = msg.shift();
                client.on(event, function(data) {
                    send(['on', event, data]);
                });
                break;
            case 'camera':
                if(cameraMode==0) {
                    client.config('video:video_channel', 3);
                    cameraMode=3;
                } else {
                    client.config('video:video_channel', 0);
                    cameraMode=0;
                }
                break;
            case 'takeoff':
                client.takeoff(function() {
                    send(['takeoff']);
                });
                break;
            case 'land':
                client.land(function() {
                    send(['land']);
                });
                break;
            default:
                console.log('unknown msg: '+kind);
                break;
        }
    });
});

require("./drone/video");
require("./drone/keypress");

server.listen(3000);
