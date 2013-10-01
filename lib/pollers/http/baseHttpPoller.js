/**
 * Module dependencies.
 */

var util = require('util');
var url  = require('url');
var BasePoller = require('../basePoller');

// The http module lacks proxy support. Let's monkey-patch it.
require('../../proxy');

/**
 * Abstract class for HTTP and HTTPS Pollers, to check web pages
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function BaseHttpPoller(target, timeout, callback) {
  BaseHttpPoller.super_.call(this, target, timeout, callback);
}

util.inherits(BaseHttpPoller, BasePoller);

BaseHttpPoller.prototype.initialize = function() {
  if (typeof(this.target) == 'string') {
    this.target = url.parse(this.target);
  }
};

/**
 * Set the User Agent, which identifies the poller to the outside world
 *
 * @param {String} user agent
 * @api   public
 */
BaseHttpPoller.prototype.setUserAgent = function(userAgent) {
  if (typeof this.target.headers == 'undefined') {
    this.target.headers = {};
  }
  this.target.headers['User-Agent'] = userAgent;
};

/**
 * Response callback
 *
 * Note that all responses may not be successful, as some return non-200 status codes,
 * and others return too slowly.
 * This method handles redirects.
 *
 * @api   private
 */
BaseHttpPoller.prototype.onResponseCallback = function(res) {
  var statusCode = res.statusCode;
  if (statusCode == 301 || statusCode == 302 || statusCode == 303 || statusCode == 307) {
    return this.handleRedirectResponse(res); // abstract, see implementations in http and https
  }
  if (statusCode != 200) {
    return this.handleErrorResponse(res);
  }
  this.handleOkResponse(res);
};

BaseHttpPoller.prototype.handleErrorResponse = function(res) {
  this.request.abort();
  this.onErrorCallback({ name: "NonOkStatusCode", message: "HTTP status " + res.statusCode});
};

BaseHttpPoller.prototype.handleOkResponse = function(res) {
  var poller = this;
  var body = '';
  this.debug(this.getTime() + "ms - Status code 200 OK");
  res.on('data', function(chunk) {
    body += chunk.toString();
    poller.debug(poller.getTime() + 'ms - BODY: ' + chunk.toString().substring(0, 100) + '...');
  });
  res.on('end', function() {
    res.body = body;
    poller.timer.stop();
    poller.debug(poller.getTime() + "ms - Request Finished");
    poller.callback(undefined, poller.getTime(), res);
  });
};

/**
 * Timeout callback
 *
 * @api   private
 */
BaseHttpPoller.prototype.timeoutReached = function() {
  BaseHttpPoller.super_.prototype.timeoutReached.call(this);
  this.request.removeAllListeners('error');
  this.request.on('error', function() { /* swallow error */ });
  this.request.abort();
};

module.exports = BaseHttpPoller;
