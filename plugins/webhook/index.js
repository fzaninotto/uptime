
var http = require('http');
var Ping = require('../../models/ping');

var config = require('config').webhook;
var http_options = {
  host: config.host,
  port: config.port,
  path: config.path,
  method: 'POST'
};

var req = http.request(http_options, function(res) {
  res.setEncoding('utf8');
  res.on('data', function (chunk) {
    console.log('BODY: ' + chunk) if (config.verbose);
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

