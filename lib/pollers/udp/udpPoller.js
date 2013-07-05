/**
 * Module dependencies.
 */

var util = require('util');
var dgram = require('dgram');
var BasePoller = require('../basePoller');

/**
 * UdpServer Singleton, using self-redefining function
 */
var getUdpServer = function() {
  var udpServer = dgram.createSocket('udp4');
  // binding required for getting responses
  udpServer.bind();
  udpServer.on('error', function () {});
  getUdpServer = function() {
    return udpServer;
  };
  return getUdpServer();
};

/**
 * UDP Poller, to check UDP services
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function UdpPoller(target, timeout, callback) {
  UdpPoller.super_.call(this, target, timeout, callback);
}

util.inherits(UdpPoller, BasePoller);

UdpPoller.type = 'udp';

UdpPoller.validateTarget = function(target) {
  var reg = new RegExp('udp:\/\/(.*):(\\d{1,5})');
  return reg.test(target);
};

UdpPoller.prototype.initialize = function() {
  this.udpServer = getUdpServer();
  var reg = new RegExp('udp:\/\/(.*):(\\d{1,5})');
  if(!reg.test(this.target)) {
   console.log(this.target + ' does not seems to be valid udp url');
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
UdpPoller.prototype.poll = function() {
  UdpPoller.super_.prototype.poll.call(this);
  var ping = new Buffer(JSON.stringify({'command': 'ping'}));
  this.udpServer.send(ping, 0, ping.length, this.target.port, this.target.address);
  this.udpServer.on("message", this.onResponseCallback.bind(this));
};

/**
 * Response callback
 * @api   private
 */
UdpPoller.prototype.onResponseCallback = function(message, sender) {
  this.debug(this.getTime() + 'ms - got answer from ' + sender.address + ':' + sender.port);
  var cmd;
  try {
    cmd = JSON.parse(message);
  } catch (e) {
    return this.onErrorCallback({ name: "Unparsable answer", message: "server return answer " + message.toString()});
  }
  if (cmd.command === 'pong') {
    this.timer.stop();
    this.debug(this.getTime() + 'ms - Got response');
    this.callback(null, this.getTime(), cmd);
  }
};

/**
 * Timeout callback
 *
 * @api   private
 */
UdpPoller.prototype.timeoutReached = function() {
  UdpPoller.super_.prototype.timeoutReached.call(this);
  this.udpServer.removeAllListeners();
};

module.exports = UdpPoller;
