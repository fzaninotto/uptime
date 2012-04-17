/*
 * Monitor remote server uptime.
 */

var http = require('http');
var url  = require('url');

http.createServer(function(req, res) {
  var arg = url.parse(req.url).pathname.substr(1);
  var chanceToGetOkResponse = parseFloat(arg) / 100;
  if (!chanceToGetOkResponse || Math.random() > chanceToGetOkResponse) {
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end('Bad Request');
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Success');
  }
}).listen(8888);