var myApp = angular.module('myApp', []);

var videoDiv = document.getElementById('video');
var ns = new NodecopterStream(videoDiv, {port: 5555});
var videoCanvas = videoDiv.querySelector('canvas');
var frameBuffer = new Uint8Array(videoCanvas.width * videoCanvas.height * 4);
var pickedColor = [192, 60, 60];
var detected;
var client = new WsClient();

var track = document.getElementById('track');
track.width = 640;
track.height = 360;
var ctx = track.getContext("2d");
ctx.fillStyle = "#FF0000";

//options
var w = videoCanvas.width;
var h = videoCanvas.height;
var nextImg = frameBuffer;
var stabImg = frameBuffer;
var c = frameBuffer;
var b = frameBuffer;
var state;
var test;
var count;
var averagePixel;


var CameraModes = {FRONT_FOLLOW:"front-follow", BOTTOM_FOLLOW:"bottom-follow"};
var camera_mode = CameraModes.FRONT_FOLLOW;

myApp.controller('Controller', ['$scope', function ($scope) {
   var tempNavdata;
    client.on('navdata', function loginNavData(navdata){
        if(navdata != null && navdata.demo != null) {
            $scope.battery = navdata.demo.batteryPercentage;
            tempNavdata = navdata;
            $('#battery').attr('value', navdata.demo.batteryPercentage);
        }
    });

    //$scope.battery;
    $scope.fps = 1000;

    setState('ground');

    $scope.mainLoop = function(){ //main function for reading drone stream and rendering detection visualization
        clearInterval(interval);
        ctx.clearRect(0, 0, w, h);

        detectColor();

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

    function detectColor(){
        var maxDiff = 98/3000;
        var accuracy = 5;

        b = frameBuffer;
        count = 0;
        var xSum = 0;
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


    /*function detectImage(){
        nextImg = frameBuffer;
        ns.getImageData(nextImg);
        var imageData = ctx.createImageData(w,h);
        var canvData = imageData.data;

        for (var i = 0; i < canvData.length; i += 4) {
            canvData[i] = nextImg[i];
            canvData[i + 1] = nextImg[i + 1];
            canvData[i + 2] = nextImg[i + 2];
            canvData[i + 3] = nextImg[i + 3];
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        test = track.toDataURL("image/png");
    }*/

    var stabilize = document.getElementById('stabilize');
    stabilize.addEventListener('click', function () {
        stabImg = frameBuffer;
        ns.getImageData(stabImg);
        //console.log(stabImg);

        client.resemble(test, test);
    });

    //dodatno koristenje ns.getimagedata

    //TODO implement yRadius/xRadius average for better consistency
    /*function getRadius(xCenter, yCenter){
        var s = frameBuffer;
       // var sL = frameBuffer;
        var xDis = Math.abs(w-xCenter);
        ns.getImageData(s, xCenter, h-yCenter, xDis, 1);
        //ns.getImageData(sL, 0, h-yCenter, xCenter, 1);

        //get farthest x to the right
        var farthestXRight = 0;

        for(var i=0; i < (xDis*4);i+=4){
            var isMatch = (Math.abs(s[i] - pickedColor[0]) / 255 < maxDiff
            && Math.abs(s[i+1] - pickedColor[1]) / 255 < maxDiff
            && Math.abs(s[i+2] - pickedColor[2]) / 255 < maxDiff);
            if(isMatch){
                farthestXRight = i/4;
            }
        }

        return farthestXRight;
    }*/

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

WsClient.prototype.clockwise = function (val) {
    this._send(['clockwise', val]);
};

WsClient.prototype.up = function (val) {
    this._send(['up', val]);
};

WsClient.prototype.front = function (val) {
    this._send(['front', val]);
};

WsClient.prototype.stop = function () {
    this._send(['stop']);
};

WsClient.prototype.camera = function () {
    this._send(['camera']);
};

WsClient.prototype.resemble = function (stabImg, nextImg) {
    this._send(['resemble', stabImg, nextImg]);
};


$(function () {

    //calculate offset for clicking and hovering on canvas
    var leftOffset = $('.widget-container').width();
    var topOffset = $('header').height();
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






