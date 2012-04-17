var server = require('dgram').createSocket("udp4");

server.on("message", function (msg, rinfo) {
  try {
    msg = JSON.parse(msg);
  } catch (e) {
    console.dir(e);
  }
  console.log("server got message:  from " + rinfo.address + ":" + rinfo.port);
  console.dir(msg);

  var pong = new Buffer(JSON.stringify({'command': 'pong'}));
  server.send(pong, 0, pong.length, rinfo.port, rinfo.address, function () {
    console.log('sent message to ' + rinfo.address + ':' + rinfo.port);
  });

});

server.on("listening", function () {
  var address = server.address();
  console.log("server listening " + address.address + ":" + address.port);
});

server.bind(41234);