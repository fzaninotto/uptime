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
    setTimeout(function() { res.end('Bad Request')}, Math.random() * 1000 );
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    setTimeout(function() { res.end('Success')}, Math.random() * 1000 );
  }
}).listen(8888);