var myApp = angular.module('myApp', []);

var videoDiv = document.getElementById('video');
var ns = new NodecopterStream(videoDiv, {port: 5555});
var videoCanvas = videoDiv.querySelector('canvas');
var frameBuffer = new Uint8Array(videoCanvas.width * videoCanvas.height * 4);
var pickedColor = [172, 107, 35];
var detected;
var client = new WsClient();

var track = document.getElementById('track');
track.width = 640;
track.height = 360;
var ctx = track.getContext("2d");
ctx.fillStyle = "#FF0000";

var maxDiff = 0.01;
var w = videoCanvas.width;
var h = videoCanvas.height;
var b = frameBuffer;
var c = new Uint8Array(4);
var averagePixel;
var count;
var state;
var initRadi = 0;
var stab = 0;


var CameraModes = {FRONT_FOLLOW:"front-follow", BOTTOM_FOLLOW:"bottom-follow"};
var camera_mode = CameraModes.FRONT_FOLLOW;


function getMaxOfArray(numArray) {
  return Math.max.apply(null, numArray);
}

function getRadius(xCenter, yCenter){
    var s = frameBuffer;
    var n = 5;      //number of rows to be taken in calculation of radius
    var maxRadi = 0;
    var xDis = Math.abs(w-xCenter);
    ns.getImageData(s, xCenter, h-yCenter, xDis, n);

    //get farthest x to the right
    var farthestXRight = [0];

    for(var j=0; j < n; j++){
        for(var i=0; i < (xDis*4);i+=4){
            var isMatch = (Math.abs(s[i + (xDis*4*j)] - pickedColor[0]) / 255 < maxDiff
            && Math.abs(s[i+1 + (xDis*4*j)] - pickedColor[1]) / 255 < maxDiff
            && Math.abs(s[i+2 + (xDis*4*j)] - pickedColor[2]) / 255 < maxDiff);
            if(isMatch){
                farthestXRight[j] = i/4;
            }
        }
    }
    maxRadi = getMaxOfArray(farthestXRight);
    //console.log("farthestXRight = ", maxRadi);
    return maxRadi;
}


myApp.controller('Controller', ['$scope', function ($scope) {
   var tempNavdata;
    client.on('navdata', function loginNavData(navdata){
        if(navdata != null && navdata.demo != null) {
            $scope.battery = navdata.demo.batteryPercentage;
            tempNavdata = navdata;
            $('#battery').attr('value', navdata.demo.batteryPercentage);
        }
    });

    $scope.fps = 500;
    $scope.battery;

    setState('ground');

    var y;
    var x;
    var xVal;
    var yVal;
    var radi;
    var radidiff;

    $scope.mainLoop = function(){ //main function for reading drone stream and rendering detection visualization
            clearInterval(interval);

            if(stab){

                ctx.clearRect(0, 0, w, h);

                //main color detection method and optimizes the color range
                detectColor();
                //color info
                updateUIText();
                //draw cross-hairs at center of detected object
                drawCrossHair(detected.x,detected.y);

                xVal = (detected.x - w / 2) / (w / 2);
                yVal = (detected.y - h/2) / (h/2);

                if(initRadi == 0){
                    initRadi = getRadius(detected.x, detected.y);
                }

                radi = getRadius(detected.x, detected.y);

                radidiff = radi - initRadi;

                //Uncomment for radius logs
                //console.log("Scope target radius: ", $scope.targetRadius);
                //console.log("r --> "+radi+"; dif --> "+radidiff+"; init -->"+initRadi);

                //Uncomment to log location info
                // console.log("|xVal: "+xVal+"|# Detected: "+count+"|X: "+Math.round(detected.x)+ "|Y: "+Math.round(detected.y)+"|AvgPixel: "+averagePixel.r);

                if (state === "follow" && !isNaN(xVal) && !isNaN(yVal)) {
                    if (camera_mode == CameraModes.FRONT_FOLLOW) {
                        followFront(xVal,yVal,radi,radidiff);
                    } else if(camera_mode == CameraModes.BOTTOM_FOLLOW){
                        followBottom(xVal,yVal);
                    }
                    else {
                        client.stop();
                    }
                } else {
                    client.stop();
                }

            }

        interval = setInterval($scope.mainLoop, $scope.fps);
    }

    var interval = setInterval($scope.mainLoop, $scope.fps);

    $scope.switchCamera = function() {
        // access the head camera

        client.camera();
        if(camera_mode == CameraModes.FRONT_FOLLOW){
            camera_mode = CameraModes.BOTTOM_FOLLOW;
        }
        else if(camera_mode == CameraModes.BOTTOM_FOLLOW){
            camera_mode = CameraModes.FRONT_FOLLOW;
        }
            console.log(camera_mode);
    }

    function followBottom(xVal,yVal){
        //TODO: add following with bottom camera
        client.stop();
    }

    function followFront(xVal, yVal, radi, radidiff){
        
        if (xVal > 0) {
            console.log('Right' + xVal);
            client.right(xVal / 20);
        }else if(xVal < 0){
            console.log('Left' + xVal);
            client.left(-xVal / 20);
        }else{
            //console.log('Stop');
            client.stop();
        }
        
        if(yVal < 0){
            console.log('Up' + yVal);
            client.up(yVal / 20);
        }else if(yVal > 0){
            console.log('Down' + yVal);
            client.down(-yVal / 20);
        }else{
            //console.log('Stop');
            client.stop();
        }
        
        
        if (radidiff < 0) {
            console.log('Front' + radidiff);
            client.front(.02);
        }
        else if(radidiff > 0) {
            console.log('Back' + radidiff);
            client.back(.02);
        } else{
            //console.log('Stop');
            client.stop();
        }
    }


    function detectColor(){
        var maxDiff = 100 /3000;
        var accuracy = 3;

        b = frameBuffer;
        count = 0;
        var xSum = 0;
        var ySum = 0;
        ns.getImageData(b);
        averagePixel = {r: 0, g: 0, b: 0};

        for (var i = 0; i < b.length; i += accuracy*4) {

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
                xSum += x;
                ySum += Math.abs(y - h);
                ctx.fillStyle = "rgb(" + b[i] + "," + b[i + 1] + "," + b[i + 2] + ")";
                ctx.fillRect(x, Math.abs(y - h), 1, 1);

                //Used for color surfing
                averagePixel.r += b[i];
                averagePixel.g += b[i + 1];
                averagePixel.b += b[i + 2];
            }
        }
        averagePixel.r = Math.round(averagePixel.r / count);
        averagePixel.g = Math.round(averagePixel.g / count);
        averagePixel.b = Math.round(averagePixel.b / count);
        detected = {x: xSum / count, y: ySum / count};

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

    function drawCrossHair(detctX, detctY){
        ctx.beginPath();
        ctx.moveTo(0, detctY);
        ctx.lineTo(640, detctY);
        ctx.moveTo(detctX, 0);
        ctx.lineTo(detctX, 360);
        ctx.strokeStyle = "black";
        ctx.stroke();
        ctx.closePath();
    }

    function updateUIText(){
        var pixelColor = "rgb(" + pickedColor[0] + ", " + pickedColor[1] + ", " + pickedColor[2] + ")";
        $('#pickedColor').css('background-color', pixelColor);
        $('#rVal').html("r: " + pickedColor[0]);
        $('#gVal').html("b: " + pickedColor[1]);
        $('#bVal').html("g: " + pickedColor[2]);
    }

    var flightButton = document.getElementById('flight');
    flightButton.addEventListener('click', function () {

        if (this.textContent === 'Start') {
            setState('takeoff');
            client.takeoff(function () {
                setState('follow');
            });
            this.textContent = 'Stop';
        } else {
            setState('land');
            client.land(function () {
                setState('ground');
            });
            this.textContent = 'Start';
        }
    });

    var stabilizeButton = document.getElementById('stabilize');
    stabilizeButton.addEventListener('click', function () {

        if (stab == 0){
            stab = 1;
            this.textContent = "Fly";
        }else{
            stab = 0;
            this.textContent = "Stabilize";
        }
        client.stabilize();
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
                    var flightButton = document.getElementById('flight');
                    flightButton.textContent = 'Stop';
                    break;
                case 'land':
                    self._landCbs.forEach(function (cb) {
                        cb();
                    });
                    self._landCbs = [];
                    var flightButton = document.getElementById('flight');
                    flightButton.textContent = 'Start';
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
        $('#rVal').html("r" + c[0]);
        $('#gVal').html("b" + c[1]);
        $('#bVal').html("g" + c[2]);
    });

});




