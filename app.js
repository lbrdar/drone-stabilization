var http = require("http"),
    drone = require("dronestream"),
    ws = require("ws"),
    fs = require("fs")
    cli = require("ar-drone").createClient(),
    keypress = require("keypress");

//Turns on all nav data
//cli.config('general:navdata_demo', 'FALSE');
cli.config('video:video_channel', 0);

var checkSrc = new RegExp('^/src', 'i'),
    checkModules = new RegExp('^/node_modules', 'i'),
    dist = ".";

var server = http.createServer(function (req, res) {

    var path = dist + req.url;
    console.log('checking static path: %s', path);

    if((req.url.indexOf('.html') != -1) || (path == './')){ //check if url contains '.html' or path is root

      fs.readFile(__dirname + '/index.html', function (err, data) {
        if (err) console.log(err);
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(data);
        res.end();
      });
    }

    if(req.url.indexOf('.js') != -1){ //check if url contains '.js'

      fs.readFile(path, function (err, data) {
        if (err) console.log(err);
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.write(data);
        res.end();
      });
    }

    if(req.url.indexOf('.css') != -1){ //check if url contains '.css'

      fs.readFile(path, function (err, data) {
        if (err) console.log(err);
        res.writeHead(200, {'Content-Type': 'text/css'});
        res.write(data);
        res.end();
      });
    }

    if ((req.url.indexOf('.png') != -1) ||(req.url.indexOf('.ico') != -1)) { //check if url contains '.png'

      fs.readFile(path, function (err, data) {
        if (err) console.log(err);
        res.writeHead(200);
        res.write(data);
        res.end();
      });
    }

});

var wsServer = new ws.Server({server: server});
wsServer.on('connection', function(conn) {
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
                cli.on(event, function(data) {
                    send(['on', event, data]);
                });
                break;
            case 'takeoff':
                //takenOff = 1;
                cli.takeoff(function() {
                    send(['takeoff']);
                });
                break;
            case 'land':
                //takenOff = 0;
                cli.land(function() {
                    send(['land']);
                });
                break;
            case 'left':
                cli.left(msg[0]);
                break;
            case 'right':
                cli.right(msg[0]);
                break;
            case 'up':
                cli.up(msg[0]);
                break;
            case 'down':
                cli.down(msg[0]);
                break;
            case 'front':
                cli.front(msg[0]);
                break;
            case 'back':
                cli.back(msg[0]);
                break;
            case 'stop':
                cli.stop();
                break;
            case 'camera':
                if(cameraMode==0) {
                    cli.config('video:video_channel', 3);
                    cameraMode=3;
                } else {
                    cli.config('video:video_channel', 0);
                    cameraMode=0;
                }
                break;
            default:
                console.log('unknown msg: '+kind);
                break;
        }
    });
    conn.on('close', function(){
        console.log('Connection to the client closed!');
    });
});


var stdin = process.openStdin(); 
process.stdin.setRawMode(true);  

// make `process.stdin` begin emitting "keypress" events 
keypress(process.stdin);

//var takenOff = 0; 

// listen for the "keypress" event 
process.stdin.on('keypress', function (ch, key) {
    if (key){
        switch(key.name){
            /*case 't': 
                if(takenOff==0){
                     cli.takeoff(function() {
                        send(['takeoff']);
                    });    
                    takenOff=1;
                } 
                break; 
            case 'g': 
                if(takenOff==1){
                    cli.land(function() {
                        send(['land']);
                    });    
                    takenOff=0;
                } 
                break;*/

            case 'a': cli.left(0.05); break;
            case 'd': cli.right(0.05); break;
            case 'w': cli.front(0.05); break;
            case 's': cli.back(0.05); break; 
            case 'i': cli.up(0.05); break;
            case 'k': cli.down(0.05); break; 

            case 'c': 
                console.log('Quitting')
                process.stdin.pause();
                cli.stop();
                cli.land();
                process.exit();
                break;
            default: 
                break;
        }
    }
});

drone.listen(5555);
server.listen(3000);

