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

var constructMessage = function(check, result, cb) {
  var message = {
    name: check.name,
    check_id: result.check,
    event_id: result._id,
    duration: result.time,
    downtime: result.downtime,
    message: result.message,
    details: result.details,
    error: result.error,
    url: check.url,
    tags: result.tags,
    timestamp: result.timestamp,
    isUp: result.isUp,
    isResponsive: result.isResponsive
  };
  cb(message);
};

var httpRequest = function(msg) {
  var req = http.request(http_options, function(res) {
    res.setEncoding('utf8');
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.write(JSON.stringify(msg));
  req.end();
};

var registerNewPingsWebhook = function() {
  Ping.on('afterInsert', function(ping) {
    ping.findCheck(function(err, check) {
      constructMessage(check, ping, httpRequest);
    });
  });
};

var registerNewEventsWebhook = function() {
  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      constructMessage(check, checkEvent, httpRequest);
    });
  });
};

