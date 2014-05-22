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
  this.isDebugEnabled = false;
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
  var client = net.connect({port: this.target.port, host: this.target.hostname}, function(){
    //If we make a connection to the remote host.
    poller.timer.stop();
    poller.debug(poller.getTime() + "ms - TCP Connection Established " + poller.target.hostname);
    client.end();
    poller.callback(null, poller.getTime());
  });
    
  //When we get an error fron net connect run this
  client.on('error', function(err) {
    poller.debug(poller.getTime() + "ms - TCP Connection Error: " + err.message  + poller.target.hostname);
    client.end();
	poller.onErrorCallback({ name: "TCP Connection Error", message: err.message});	
  });
   
  //If we close the connection run this
  client.on('end', function() {
    poller.debug(poller.getTime() + "ms - TCP Connection End "  + poller.target.hostname);
	client.destroy();  //this should not be required but it seams to need it.
  });
	  
	//This is at the bottom just to give it a bit fo a delay without useing setTimeout delay.
  client.setTimeout(this.timeoutReached, this.timeout);
};
module.exports = TcpPoller;
