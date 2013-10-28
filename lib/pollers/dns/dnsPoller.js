/**
 * Module dependencies.
 */

var util = require('util');
var dnsclient = require('native-dns');
var tld = require('tldjs');
var net  = require('net');
var BasePoller = require ('../basePoller');

/**
 * DNS Poller, checks DNS server and domain hostname resolution health
 *
 * @param {Mixed} Poller Target (e.g. URL) - Format: dns://www.example.com[@8.8.8.8]
 * @param {Number} Poller timeout in milliseconds. Max time to wait for a reponse from the server.
 * @param {Function} Error/success callback
 * @api   public
 */
function DnsPoller(target, timeout, callback) {
  this.target   = target;
  this.timeout  = timeout || 2000;
  this.callback = callback;
  this.isDebugEnabled = false;
  this.server = '8.8.8.8';
  this.initialize();
}

util.inherits(DnsPoller, BasePoller);

DnsPoller.type = 'dns';

DnsPoller.validateTarget = function(target) {
  var reg = new RegExp('dns:\/\/([^@]*)(@.*)?');
  return reg.test(target);
};

/**
 * Initializer method
 *
 * @api   public
 */
DnsPoller.prototype.initialize = function() {
  var reg = new RegExp('dns:\/\/([^@]*)(?:@.*)?');
  var reg2 = new RegExp('dns:\/\/(?:[^@]*)@(.*)');

  if(!reg.test(this.target)) {
    console.log(this.target + ' does not seem to be a valid DNS URL');
  }

  if(reg2.test(this.target)) {
    var remote = reg2.exec(this.target)[1];
    if(net.isIP(remote) > 0) {
      this.server = remote;
    } else {
      console.log(remote + ' does not seem to be a valid IP address');
    }
  }
    
  this.target = reg.exec(this.target)[1];
  
  if(!tld.isValid(this.target)) {
    console.log(this.target + ' does not seem to be a valid domain name');
  }

  this.question = dnsclient.Question({
  name: this.target,
  type: dnsclient.consts.NAME_TO_QTYPE.A,
  });
  
  this.req = dnsclient.Request({
    question: this.question,
    server: { address: this.server, port: 53, type: 'udp' },
    timeout: this.timeout,
  });
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
DnsPoller.prototype.poll = function() {
  DnsPoller.super_.prototype.poll.call(this);
  this.req.send();
  this.req.on("timeout", this.onTimeoutCallback.bind(this));
  this.req.on("message", this.onResponseCallback.bind(this));
};

/**
 * Response callback
 * @api   private
 */
DnsPoller.prototype.onResponseCallback = function(err, answer) {
  this.timer.stop();

  if(err) {
    this.onErrorCallback(err);
  } else {
    this.callback(null, this.getTime());
  }
};

/**
 * Error callback
 * @api   private
 */
DnsPoller.prototype.onErrorCallback = function(err) {
  this.timer.stop();
  this.debug(this.getTime() + "ms - Got error: " + err.code);
  this.callback(err, this.getTime());
};

/**
 * Timeout callback
 * @api   private
 */
DnsPoller.prototype.onTimeoutCallback = function() {
  this.timer.stop();
  this.debug(this.getTime() + "ms - Request timed out");
  this.callback({name: "Request time-out", message: "The Server did not respond in time"}, this.getTime());
};

module.exports = DnsPoller;
