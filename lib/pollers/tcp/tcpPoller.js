/**
 * Module dependencies.
 */

var util = require('util');
var tcpp = require('tcp-ping');
var BasePoller = require('../basePoller');

/**
 * TCP Poller, to check TCP services
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
  var reg = new RegExp('tcp:\/\/(.*):(\\d{1,5})');
  return reg.test(target);
};

TcpPoller.prototype.initialize = function() {
  var reg = new RegExp('tcp:\/\/(.*):(\\d{1,5})');
  if(!reg.test(this.target)) {
   console.log(this.target + ' does not seems to be valid tcp url');
  }
  var host = reg.exec(this.target);
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
  TcpPoller.super_.prototype.poll.call(this);
  tcpp.probe(this.target.address, this.target.port, this.onResponseCallback.bind(this));
};

/**
 * Response callback
 * @api   private
 */
TcpPoller.prototype.onResponseCallback = function(err, available) {
  this.debug(this.getTime() + 'ms - ' + this.target.address + ':' + this.target.port + ' is available (' + available + ')');
  if (available) {
    this.timer.stop();
    this.debug(this.getTime() + 'ms - Got response');
    this.callback(null, this.getTime());
  }
};

/**
 * Timeout callback
 *
 * @api   private
 */
TcpPoller.prototype.timeoutReached = function() {
  TcpPoller.super_.prototype.timeoutReached.call(this);
  //this.tcpServer.removeAllListeners();
};

module.exports = TcpPoller;
