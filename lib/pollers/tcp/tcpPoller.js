
var tcpp = require('tcp-ping');
var util = require('util');
var BasePoller = require('../basePoller');

/**
 * UDP Poller, to check UDP services
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function TcpPoller(target, timeout, callback) {
  TcpPoller.super_.call(this, target, timeout, callback);
}

util.inherits(TcpPoller, BasePoller);

TcpPoller.type = 'tcp';

TcpPoller.validateTarget = function(target) {
  var reg = new RegExp('http:\/\/(.*):(\\d{1,5})');
  console.log("TCPPoller: validating target")
  return reg.test(target);
};

TcpPoller.prototype.initialize = function() {
  var reg = new RegExp('http:\/\/(.*):(\\d{1,5})');
  console.log("TCPPoller: Initialize protocol")
  if(!reg.test(this.target)) {
   console.log(this.target + ' does not seems to be valid tcp url');
  }
  var host = reg.exec(this.target);
  console.log("TCPPoller : " + host[1] + " " + host[2])
  this.target = {
    'address': host[1],
    'port': host[2]
  };
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
TcpPoller.prototype.poll = function() {
console.log("TCPPoller: starting to poll")
  TcpPoller.super_.prototype.poll.call(this);
  console.log("TCPPoller: Polling " + this.target.address + " " + this.target.port)
  tcpp.probe(this.target.address, this.target.port, this.onResponseCallback.bind(this));
};


/**
 * Response callback
 * @api   private
 */
TcpPoller.prototype.onResponseCallback = function(err, available) {
  if (available == true) {
      this.timer.stop();
      this.debug(this.getTime() + 'ms - Got response');
      this.callback(null, this.getTime(), "success");
   }
};

/**
 * Timeout callback
 *
 * @api   private
 */
TcpPoller.prototype.timeoutReached = function() {
  TcpPoller.super_.prototype.timeoutReached.call(this);
  console.log("TCPPoller Error timeout reached")
};


module.exports = TcpPoller;