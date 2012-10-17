var Ping = require('../../models/ping');
var CheckEvent = require('../../models/checkEvent');
var http = require('http');

var config = require('config').webhook;
var http_options = {
  host: config.host,
  port: config.port,
  path: config.path,
  method: 'POST'
};

exports.init = function(enableNewEvents, enableNewPings) {
  if (typeof enableNewEvents == 'undefined') enableNewEvents = true;
  if (typeof enableNewPings == 'undefined') enableNewPings = false;
  if (enableNewEvents) registerNewEventsWebhook();
  if (enableNewPings)  registerNewPingsWebhook();
};

var httpRequest = function(data) {
  var req = http.request(http_options, function(res) {
    res.setEncoding('utf8');
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.write(JSON.stringify(data));
  req.end();
};

var registerNewPingsWebhook = function() {
  Ping.on('afterInsert', function(ping) {
    ping.findCheck(function(err, check) {
      httpRequest(ping);
    });
  });
};

var registerNewEventsWebhook = function() {
  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      httpRequest(checkEvent);
    });
  });
};

