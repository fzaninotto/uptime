/**
 * Module dependencies.
 */

var util = require('util');
var http = require('http');
var url  = require('url');
var BasePoller = require('./base');

// The http module lacks proxy support. Let's monkey-patch it.
require('../proxy');

/**
 * Poller constructor
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function HttpPoller(target, timeout, callback) {
  HttpPoller.super_.call(this, target, timeout, callback);
}

util.inherits(HttpPoller, BasePoller);

HttpPoller.prototype.initialize = function() {
  if (typeof(this.target) == 'string') {
    this.target = url.parse(this.target);
  }
}

/**
 * Launch the actual polling
 *
 * @api   public
 */
HttpPoller.prototype.poll = function() {
  HttpPoller.super_.prototype.poll.call(this);
  this.request = http.get(this.target, this.onResponseCallback.bind(this));
  this.request.on('error', this.onErrorCallback.bind(this));
}

/**
 * Response callback
 *
 * Note that all responses may not be successful, as some return non-200 status codes,
 * and others return too slowly.
 * This method handles redirects.
 *
 * @api   private
 */
HttpPoller.prototype.onResponseCallback = function(res) {
  var statusCode = res.statusCode;
  var poller = this;
  if (statusCode == 301 || statusCode == 302) {
    this.debug(this.getTime() + "ms - Got redirect response to " + res.headers.location);
    var target = url.parse(res.headers.location);
    if (target.protocol == 'http:') {
      this.target = target;
      return this.poll();
    } else {
      this.request.abort();
      return this.onErrorCallback({ name: "WrongRedirectUrl", message: "Received redirection from http: to " + target.protocol});
    }
  }
  if (statusCode == 200) {
    var body = '';
    this.debug(this.getTime() + "ms - Status code 200 OK");
    res.on('data', function(chunk) {
      body += chunk.toString();
      poller.debug(poller.getTime() + 'ms - BODY: ' + chunk.toString().substring(0, 100) + '...');
    });
    res.on('end', function() {
      poller.timer.stop();
      poller.debug(poller.getTime() + "ms - Request Finished");
      poller.callback(undefined, poller.getTime(), body);
    });
  } else {
    this.request.abort();
    this.onErrorCallback({ name: "NonOkStatusCode", message: "HTTP status " + statusCode});
  }
}

/**
 * Timeout callback
 *
 * @api   private
 */
HttpPoller.prototype.timeoutReached = function() {
  HttpPoller.super_.prototype.timeoutReached.call(this);
  this.request.removeAllListeners('error');
  this.request.on('error', function() { /* swallow error */ });
  this.request.abort();
}

module.exports = HttpPoller;