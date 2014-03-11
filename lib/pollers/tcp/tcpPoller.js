/**
 * Module dependencies
 */
 var util = require('util');
 var net = require('net');
 var url = require('url');
 var dns = require('dns'); var dgram = require('dgram'); var BasePoller = 
 require('../basePoller');

 /**
 * TCP Poller constructor
 *
 */ function TcpPoller(target, timeout, callback) {
  this.target = target;
  this.timeout = timeout || 1000;
  this.callback = callback;
  this.isDebugEnabled = true;
  this.initialize();
}
util.inherits(TcpPoller, BasePoller); TcpPoller.type = 'tcp'; TcpPoller.validateTarget = 
function(target) {
  var reg = new RegExp('tcp:\/\/(.*):(\\d{1,5})');
  return reg.test(target);
};
TcpPoller.prototype.initialize = function() {
  var poller = this;
  var reg = new RegExp('tcp:\/\/(.*)');
  if(!reg.test(this.target)) {
    console.log(this.target + ' does not seem to be a valid TCP URL');
  }
  if(typeof(this.target) == 'string') {
    this.target = url.parse(this.target);
  }
  this.target.port = this.target.port || 80;
  if(net.isIP(this.target.hostname) === 0) {
    dns.lookup(this.target.hostname, function(error, address, family) {
        if(error) {
          poller.debug("TCP Connection -- DNS Lookup Error: " + error.message);
        } else {
          poller.target.hostname = address;
        }
    });
  }
};
TcpPoller.prototype.poll = function() {
  TcpPoller.super_.prototype.poll.call(this);
  var poller = this;
  var client = net.connect({port: this.target.port, host: this.target.hostname}, function() 
{
    poller.timer.stop();
    poller.debug(poller.getTime() + "ms - TCP Connection Established");
    client.end();
    poller.callback(undefined, poller.getTime());
  });
  client.setTimeout(this.timeoutReached, this.timeout);
  client.on('error', function(err) {
   poller.debug(poller.getTime() + "ms - TCP Connection Error: " + err.message);
    client.end();
    poller.callback(null, poller.getTime());
  });
  client.on('end', function() {
    poller.debug(poller.getTime() + "ms - TCP Connection End");
      });
};
module.exports = TcpPoller;
