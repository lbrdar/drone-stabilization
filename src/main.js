var myApp = angular.module('myApp', []);

var videoDiv = document.getElementById('video');
var ns = new NodecopterStream(videoDiv, {port: 5555});
var videoCanvas = videoDiv.querySelector('canvas');
var frameBuffer = new Uint8Array(videoCanvas.width * videoCanvas.height * 4);
var pickedColor = [0,0,0];
var detected;
var client = new WsClient();

var track = document.getElementById('track');
track.width = 640;
track.height = 360;
var ctx = track.getContext("2d");
ctx.fillStyle = "#FF0000";

//options
var maxDiff = 0.01;
var w = videoCanvas.width;
var h = videoCanvas.height;
var b = frameBuffer;
var c = new Uint8Array(4);
var averagePixel;
var count;
var lastCount;
var state;
var altitude;


var CameraModes = {FRONT_FOLLOW:"front-follow", BOTTOM_FOLLOW:"bottom-follow"};
var camera_mode = CameraModes.FRONT_FOLLOW;


myApp.controller('Controller', ['$scope', function ($scope) {

    client.on('navdata', function loginNavData(navdata){
        if(navdata != null && navdata.demo != null) {
            altitude = navdata.demo.altitudeMeters;
            $('#battery').attr('value', navdata.demo.batteryPercentage);
            $('#altitude').html(navdata.demo.altitudeMeters);
        }
    });

    setState('ground');

    var fps = 800;
    var x;
    var y;
    var xVal;
    var yVal;

    $scope.mainLoop = function(){ 
        clearInterval(interval);
        ctx.clearRect(0, 0, w, h);

        detectColor();      //color detection method and optimizes the color range
        updateUIText();     //color info

        keepAltitude(0.7);

        if (state === "follow") {
            if (!isNaN(detected.xLeft) && !isNaN(detected.xRight) && (detected.xLeft != 0) && (detected.xRight != 0)){
                client.front(0.007);
                //console.log("Oboje okej, idem naprijed");
                //console.log("Detected x left is ", detected.xLeft, ", detected x right is ", detected.xRight);
            }else{
                client.back(0.007);
                //console.log("Nesto ne stima, idem nazad");
                //console.log("Detected x left is ", detected.xLeft, ", detected x right is ", detected.xRight);
            }
        }else{
            client.stop();
        }

        //xVal = (detected.x - w / 2) / (w / 2);
        //yVal = (detected.y - h/2) / (h/2);

        interval = setInterval($scope.mainLoop, fps);
    }

    var interval = setInterval($scope.mainLoop, fps);

    $scope.switchCamera = function() {
        client.camera();
        if(camera_mode == CameraModes.FRONT_FOLLOW){
            camera_mode = CameraModes.BOTTOM_FOLLOW;
        }
        else if(camera_mode == CameraModes.BOTTOM_FOLLOW){
            camera_mode = CameraModes.FRONT_FOLLOW;
        }
            console.log(camera_mode);
    }

    function keepAltitude(normalAltitude){
        if(altitude > normalAltitude){
            client.down(0.007);
            console.log("VEĆI SAM ZA ", altitude -normalAltitude);
        }else if(altitude < normalAltitude){
            client.up(0.07);
            console.log("MANJI SAM ZA ", normalAltitude - altitude);
        }
    }

    function detectColor(){
        var maxDiff = 100 /3000;
        var accuracy = 20;

        b = frameBuffer;
        count = 0;
        var xSumLeft = 0;
        var xSumRight = 0;
        var ySum = 0;
        ns.getImageData(b);
        averagePixel = {r: 0, g: 0, b: 0};
        for (var i = 0; i < b.length; i += accuracy) {

            var match = true;
            for (var j = 0; j < pickedColor.length; j++) {

                var diffPercent = Math.abs(b[i + j] - pickedColor[j]) / 255;
                if (diffPercent > maxDiff) {
                    match = false;
                    break;
                }
            }
            if (match) {
                count++;
                y = i / (w * 4);
                x = i % (w * 4) / 4;

                if (x > (w / 2)){
                    xSumRight += x;
                }else{
                    xSumLeft += x;
                }
                ySum += Math.abs(y - h);
                //ctx.fillStyle = "rgb(" + b[i] + "," + b[i + 1] + "," + b[i + 2] + ")";
                //ctx.fillRect(x, Math.abs(y - h), 1, 1);

                //Used for color surfing
                averagePixel.r += b[i];
                averagePixel.g += b[i + 1];
                averagePixel.b += b[i + 2];
            }
        }
        averagePixel.r = Math.round(averagePixel.r / count);
        averagePixel.g = Math.round(averagePixel.g / count);
        averagePixel.b = Math.round(averagePixel.b / count);
        detected = {xLeft: xSumLeft / count, xRight: xSumRight / count, y: ySum / count};

        if (averagePixel.r > pickedColor[0]) {
            pickedColor[0]++;
        } else if (averagePixel.r < pickedColor[0]) {
            pickedColor[0]--;
        }
        if (averagePixel.g > pickedColor[1]) {
            pickedColor[1]++;
        } else if (averagePixel.g < pickedColor[1]) {
            pickedColor[1]--;
        }
        if (averagePixel.b > pickedColor[2]) {
            pickedColor[2]++;
        } else if (averagePixel.b < pickedColor[2]) {
            pickedColor[2]--;
        }
    }


    function updateUIText(){
        var pixelColor = "rgb(" + pickedColor[0] + ", " + pickedColor[1] + ", " + pickedColor[2] + ")";
        $('#pickedColor').css('background-color', pixelColor);
        $('#rVal').html("r: " + pickedColor[0]);
        $('#gVal').html("b: " + pickedColor[1]);
        $('#bVal').html("g: " + pickedColor[2]);
        lastCount = count;
    }

    var flightButton = document.getElementById('flight');
    var flightPic = document.getElementById('flightPic');
    flightButton.addEventListener('click', function () {
        if (flightPic.src == 'http://localhost:3000/src/img/takeoff.png') {
            setState('takeoff');
            client.takeoff(function () {
                setState('follow');
            });
            flightPic.setAttribute("src", "http://localhost:3000/src/img/landing.png");

        } else {
            setState('land');
            client.land(function () {
                setState('ground');
            });
            flightPic.setAttribute("src", "http://localhost:3000/src/img/takeoff.png");
        }
    });

}]);


function setState(val) {
    console.log('new state: ' + val);
    this.state = val;
}

function WsClient() { //WsClient sends drone flight commands to the server
    this._conn = null;
    this._connected = false;
    this._queue = [];
    this._listeners = {};
    this._takeoffCbs = [];
    this._landCbs = [];

    var self = this;
    self._conn = new WebSocket('ws://' + window.location.host);
    self._conn.onopen = function () {
        self._connected = true;
        self._queue.forEach(function (msg) {
            self._conn.send(msg);
        });
        self._queue = [];

        self._conn.onmessage = function (msg) {
            try {
                msg = JSON.parse(msg.data);
            } catch (err) {
                console.error(err);
                return;
            }
            var kind = msg.shift();
            switch (kind) {
                case 'takeoff':
                    self._takeoffCbs.forEach(function (cb) {
                        cb();
                    });
                    self._takeoffCbs = [];
                    break;
                case 'land':
                    self._landCbs.forEach(function (cb) {
                        cb();
                    });
                    self._landCbs = [];
                    break;
                case 'on':
                    var event = msg.shift();
                    self._listeners[event].forEach(function (cb) {
                        cb.apply(self, msg);
                    });
                    break;
                default:
                    console.error('unknown message: ' + kind);
            }
        };
    };

}

WsClient.prototype._connect = function () {
    var self = this;
    self._conn = new WebSocket('ws://' + window.location.host);
    self._conn.onopen = function () {
        self._connected = true;
        self._queue.forEach(function (msg) {
            self._conn.send(msg);
        });
        self._queue = [];

        self._conn.onmessage = function (msg) {
            try {
                msg = JSON.parse(msg.data);
            } catch (err) {
                console.error(err);
                return;
            }
            var kind = msg.shift();
            switch (kind) {
                case 'takeoff':
                    self._takeoffCbs.forEach(function (cb) {
                        cb();
                    });
                    self._takeoffCbs = [];
                    break;
                case 'land':
                    self._landCbs.forEach(function (cb) {
                        cb();
                    });
                    self._landCbs = [];
                    break;
                case 'on':
                    var event = msg.shift();
                    self._listeners[event].forEach(function (cb) {
                        cb.apply(self, msg);
                    });
                    break;
                default:
                    console.error('unknown message: ' + kind);
            }
        };
    };

};

WsClient.prototype._send = function (msg) {
    msg = JSON.stringify(msg);
    if (!this._connected) {
        this._queue.push(msg);
        return;
    }
    this._conn.send(msg);
};

WsClient.prototype.on = function (event, cb) {
    var cbs = this._listeners[event] = this._listeners[event] || [];
    cbs.push(cb);
    if (cbs.length === 1) {
        this._send(['on', event]);
    }
};

WsClient.prototype.takeoff = function (cb) {
    this._send(['takeoff']);
    if (cb) {
        this._takeoffCbs.push(cb);
    }
};

WsClient.prototype.land = function (cb) {
    this._send(['land']);
    if (cb) {
        this._landCbs.push(cb);
    }
};

WsClient.prototype.right = function (val) {
    this._send(['right', val]);
};

WsClient.prototype.left = function (val) {
    this._send(['left', val]);
};

WsClient.prototype.clockwise = function (val) {
    this._send(['clockwise', val]);
};

WsClient.prototype.up = function (val) {
    this._send(['up', val]);
};

WsClient.prototype.down = function (val) {
    this._send(['down', val]);
};

WsClient.prototype.front = function (val) {
    this._send(['front', val]);
};

WsClient.prototype.back = function (val) {
    this._send(['back', val]);
};

WsClient.prototype.stop = function () {
    this._send(['stop']);
};

WsClient.prototype.camera = function () {
    this._send(['camera']);
};

WsClient.prototype.stabilize = function () {
    this._send(['stabilize']);
};

//Listeners//
$(function () {

    $('#testCanvas').hide();

    //calculate offset for clicking and hovering on canvas
    var leftOffset = $('.widget-container').width();
    var topOffset = 0;
    var canvasOffset = {left: leftOffset, top: topOffset};

    $('#video').mousemove(function (e) { // mouse move handler

        var canvasX = Math.floor(e.pageX - canvasOffset.left);
        var canvasY = Math.floor(e.pageY - canvasOffset.top);

        ns.getImageData(c, canvasX, h - canvasY, 1, 1);

        var pixelColor = "rgb(" + c[0] + ", " + c[1] + ", " + c[2] + ")";
        $('#preview').css('background-color', pixelColor);
    });

    $('#video').click(function (e) { // mouse click handler

        var canvasX = Math.floor(e.pageX - canvasOffset.left);
        var canvasY = Math.floor(e.pageY - canvasOffset.top);

        ns.getImageData(c, canvasX, h - canvasY, 1, 1);

        //change detection color
        pickedColor[0] = c[0];
        pickedColor[1] = c[1];
        pickedColor[2] = c[2];

        var pixelColor = "rgb(" + pickedColor[0] + ", " + pickedColor[1] + ", " + pickedColor[2] + ")";
        $('#pickedColor').css('background-color', pixelColor);

        //color info
        $('#rVal').html("r" + c[0]);
        $('#gVal').html("b" + c[1]);
        $('#bVal').html("g" + c[2]);

        $('#rgbVal').val(c[0] + ',' + c[1] + ',' + c[2]);
        $('#rgbaVal').val(c[0] + ',' + c[1] + ',' + c[2] + ',' + c[3]);
        var dColor = c[2] + 256 * c[1] + 65536 * c[0];
        $('#hexVal').html('Hex: #' + dColor.toString(16));
    });

    /*setInterval(function updateUIPixelCount() {
        $('#pixelCount').html("# Pixels "+lastCount);
    }, 300);*/

});




