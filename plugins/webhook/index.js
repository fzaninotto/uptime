var Ping = require('../../models/ping');
var CheckEvent = require('../../models/checkEvent');
var http = require('http');

var config = require('config').webhook;
var http_options = {};
if (typeof config.ping !== 'undefined') {
  http_options.ping = {
    host: config.ping.host,
    port: config.ping.port,
    path: config.ping.path,
    method: 'POST'
  };
}
if (typeof config.check !== 'undefined') {
  http_options.check = {
    host: config.check.host,
    port: config.check.port,
    path: config.check.path,
    method: 'POST'
  };
}

exports.init = function(enableNewChecks, enableNewPings) {
  if (typeof enableNewChecks == 'undefined') enableNewChecks = true;
  if (typeof enableNewPings == 'undefined') enableNewPings = false;
  if (enableNewChecks && http_options.check) registerNewChecksWebhook();
  if (enableNewPings && http_options.ping)  registerNewPingsWebhook();
};

var constructMessage = function(check, result, type) {
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
    isResponsive: result.isResponsive,
    type: type
  };
  return message;
};

var httpRequest = function(msg) {
  if (msg.type === 'check') {
    var req = http.request(http_options.check, function(res) {
      res.setEncoding('utf8');
    });
  } else if (msg.type === 'ping') {
    var req = http.request(http_options.ping, function(res) {
      res.setEncoding('utf8');
    });
  }
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.write(JSON.stringify(msg));
  req.end();
};

var registerNewChecksWebhook = function() {
  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      httpRequest(constructMessage(check, checkEvent, 'check'));
    });
  });
};

var registerNewPingsWebhook = function() {
  Ping.on('afterInsert', function(ping) {
    ping.findCheck(function(err, check) {
      httpRequest(constructMessage(check, ping, 'ping'));
    });
  });
};

