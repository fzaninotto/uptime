
var http = require('http');
var Ping = require('../../models/ping');
var CheckEvent  = require('../../models/checkEvent');

var config = require('config');
var http_options = {
  host: config.webhook.host,
  port: config.webhook.port,
  path: config.webhook.path,
  method: 'POST'
};

var req = http.request(http_options, function(res) {
  res.setEncoding('utf8');
  res.on('data', function (chunk) {
    console.log('BODY: ' + chunk);
  });
});

req.on('error', function(e) {
  console.log('problem with request: ' + e.message);
});

req.end();

exports.init = function() {
  Ping.on('afterInsert', function(ping) {
    ping.findCheck(function(err, check) {
      req.write(JSON.stringify(ping));
    });
  });
};

