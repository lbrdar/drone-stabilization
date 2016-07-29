var myApp = angular.module('myApp', []);
//var resemble = require("resemblejs");

var videoDiv = document.getElementById('video');
var ns = new NodecopterStream(videoDiv, {port: 5555});
var videoCanvas = videoDiv.querySelector('canvas');
var ctx = videoCanvas.getContext("2d");
var frameBuffer = new Uint8Array(videoCanvas.width * videoCanvas.height * 4);
var client = new WsClient();

var cw = videoCanvas.width;
var ch = videoCanvas.height;
//var fps = 200;

//ar resembleControl;
var nextImage = frameBuffer;
var stabImage = frameBuffer;
//ns.getImageData(stabImage);

var CameraModes = {FRONT_FOLLOW:"front-follow", BOTTOM_FOLLOW:"bottom-follow"};
var camera_mode = CameraModes.FRONT_FOLLOW;

myApp.controller('Controller', ['$scope', function ($scope) {

    client.on('navdata', function loginNavData(navdata){
        if(navdata != null && navdata.demo != null) {
            $scope.battery = navdata.demo.batteryPercentage;
            $('#battery').attr('value', navdata.demo.batteryPercentage);
        }
    });

    /*var timer = setInterval($scope.mainLoop, fps);
    
    $scope.mainLoop = function(){       //main function for reading drone stream and image manipulation
            clearInterval(timer);
            ctx.clearRect(0, 0, w, h);
            detectChange();
            timer = setInterval($scope.mainLoop, fps);
    };*/
    
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
    };

    stabImage = ns.getImageData;

    function detectChange(){
        nextImage = frameBuffer;
        //ns.getImageData(nextImage);

        //resembleControl = resemble(nextImage).compareTo(stabImage).onComplete(onComplete);
    }

    function onComplete(data){
        console.log('Change found');
        console.log(data);

        //var diffImage = new Image();

        /*if(data.misMatchPercentage == 0){
            $('#thesame').show();
            $('#diff-results').hide();
        } else {
            $('#mismatch').text(data.misMatchPercentage);
            if(!data.isSameDimensions){
                $('#differentdimensions').show();
            } else {
                $('#differentdimensions').hide();
            }
            $('#diff-results').show();
            $('#thesame').hide();
        }*/
    }
    
    var flightButton = document.getElementById('flight');
    flightButton.addEventListener('click', function () {

        if (this.textContent === 'Start') {
            //setState('takeoff');
            client.takeoff();
            this.textContent = 'Stop';
        } else {
            //setState('land');
            client.land();
            this.textContent = 'Start';
        }
    });

    var imageDiffButton = document.getElementById('img-diff');
    imageDiffButton.addEventListener('click', function () {
        console.log('Button img-diff click');
        detectChange();
    });
    
}]);

function WsClient() { //WsClient sends drone flight commands to the server
    this._conn = null;
    this._connected = false;
    this._queue = [];
    this._listeners = {};

    var self = this;
    self._conn = new WebSocket('ws://localhost:3000');
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
    self._conn = new WebSocket('ws://localhost:3001');
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

WsClient.prototype.camera = function () {
    this._send(['camera']);
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