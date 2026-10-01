"use strict";

var QWebChannelMessageTypes = {
    signal: 1,
    propertyUpdate: 2,
    init: 3,
    idle: 4,
    debug: 5,
    invokeMethod: 6,
    connectToSignal: 7,
    disconnectFromSignal: 8,
    setProperty: 9,
    response: 10
};

var QWebChannel = function(transport, initCallback) {
    if (typeof transport !== "object" || typeof transport.send !== "function") {
        console.error("The QWebChannel expects a transport object with a send function and onmessage callback property." +
                      " Given is: transport: " + typeof(transport) + ", transport.send: " + typeof(transport.send));
        return;
    }

    var channel = this;
    this.transport = transport;

    this.send = function(data) {
        if (typeof(data) !== "string") {
            data = JSON.stringify(data);
        }
        channel.transport.send(data);
    };

    this.transport.onmessage = function(message) {
        var data = message.data;
        if (typeof data === "string") {
            data = JSON.parse(data);
        }
        switch (data.type) {
            case QWebChannelMessageTypes.signal:
                channel.handleSignal(data);
                break;
            case QWebChannelMessageTypes.response:
                channel.handleResponse(data);
                break;
            case QWebChannelMessageTypes.propertyUpdate:
                channel.handlePropertyUpdate(data);
                break;
            default:
                console.error("invalid message received:", message.data);
                break;
        }
    };

    this.execCallbacks = {};
    this.execId = 0;
    this.exec = function(data, callback) {
        if (!callback) {
            channel.send(data);
            return;
        }
        if (channel.execId === Number.MAX_VALUE) {
            channel.execId = Number.MIN_VALUE;
        }
        if (data.hasOwnProperty("id")) {
            console.error("Cannot exec message with pre-existing id: " + JSON.stringify(data));
            return;
        }
        var id = channel.execId++;
        channel.execCallbacks[id] = callback;
        data.id = id;
        channel.send(data);
    };

    this.objects = {};

    this.handleSignal = function(message) {
        var object = channel.objects[message.object];
        if (object) {
            object.signalEmitted(message.signal, message.args);
        } else {
            console.warn("Unhandled signal: " + message.object + "::" + message.signal);
        }
    };

    this.handleResponse = function(message) {
        if (!message.hasOwnProperty("id")) {
            console.error("Invalid response message received: ", JSON.stringify(message));
            return;
        }
        channel.execCallbacks[message.id](message.data);
        delete channel.execCallbacks[message.id];
    };

    this.handlePropertyUpdate = function(message) {
        for (var i = 0; i < message.data.length; ++i) {
            var data = message.data[i];
            var object = channel.objects[data.object];
            if (object) {
                object.propertyUpdate(data.signals, data.properties);
            } else {
                console.warn("Unhandled property update: " + data.object + "::" + data.signal);
            }
        }
        channel.exec({type: QWebChannelMessageTypes.idle});
    };

    this.debug = function(message) {
        channel.send({type: QWebChannelMessageTypes.debug, data: message});
    };

    QWebChannel.prototype.unwrapQObject = function(response) {
        if (response instanceof Array) {
            var ret = [];
            for (var i = 0; i < response.length; ++i) {
                ret.push(this.unwrapQObject(response[i]));
            }
            return ret;
        }
        if (!response || !response["__QObject*__"]) {
            return response;
        }
        var objectId = response.id;
        if (this.objects[objectId]) {
            return this.objects[objectId];
        }
        var ws = this;
        var object = new QObject(objectId, response.data, this);
        this.objects[objectId] = object;
        return object;
    };

    this.exec({type: QWebChannelMessageTypes.init}, function(data) {
        for (var objectName in data) {
            var object = new QObject(objectName, data[objectName], channel);
        }
        for (var objectName in data) {
            channel.objects[objectName].unwrapProperties();
        }
        if (initCallback) {
            initCallback(channel);
        }
    });
};

function QObject(name, data, webChannel) {
    this.__id__ = name;
    var self = this;
    webChannel.objects[name] = this;

    for (var i = 0; i < data.methods.length; ++i) {
        var method = data.methods[i];
        (function(methodName) {
            self[methodName] = function() {
                var args = [];
                var callback;
                for (var j = 0; j < arguments.length; ++j) {
                    if (typeof arguments[j] === "function")
                        callback = arguments[j];
                    else
                        args.push(arguments[j]);
                }
                webChannel.exec({
                    "type": QWebChannelMessageTypes.invokeMethod,
                    "object": self.__id__,
                    "method": methodName,
                    "args": args
                }, function(response) {
                    if (response !== undefined) {
                        var result = webChannel.unwrapQObject(response);
                        if (callback) {
                            callback(result);
                        }
                    }
                });
            };
        })(method[0]);
    }

    this.unwrapProperties = function() {
        for (var propertyName in data.properties) {
            self[propertyName] = webChannel.unwrapQObject(data.properties[propertyName]);
        }
    };

    this.signalEmitted = function(signalName, signalArgs) {
        var connections = self[signalName].connections;
        for (var i = 0; i < connections.length; ++i) {
            connections[i].apply(connections[i], signalArgs);
        }
    };

    for (var i = 0; i < data.signals.length; ++i) {
        var signal = data.signals[i];
        (function(signalName) {
            self[signalName] = {
                connections: [],
                connect: function(callback) {
                    if (typeof callback !== "function") {
                        console.error("Bad callback given to connect to signal " + signalName);
                        return;
                    }
                    this.connections.push(callback);
                }
            };
        })(signal[0]);
    }
}
