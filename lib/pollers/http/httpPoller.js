/**
 * Module dependencies.
 */

var util = require('util');
var http = require('http');
var url  = require('url');
var BaseHttpPoller = require('./baseHttpPoller');
var HttpsPoller = require('../https/httpsPoller.js');

// The http module lacks proxy support. Let's monkey-patch it.
require('../../proxy');

/**
 * HTTP Poller, to check web pages
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function HttpPoller(target, timeout, callback) {
  HttpPoller.super_.call(this, target, timeout, callback);
}

HttpPoller.type = 'http';

util.inherits(HttpPoller, BaseHttpPoller);

/**
 * Launch the actual polling
 *
 * @api   public
 */
HttpPoller.prototype.poll = function() {
  HttpPoller.super_.prototype.poll.call(this);
  this.request = http.get(this.target, this.onResponseCallback.bind(this));
  this.request.on('error', this.onErrorCallback.bind(this));
};

// see inherited function BaseHttpPoller.prototype.onResponseCallback
// see inherited function BaseHttpPoller.prototype.onErrorCallback

HttpPoller.prototype.handleRedirectResponse = function(res) {
  this.debug(this.getTime() + "ms - Got redirect response to " + res.headers.location);
  var target = url.parse(res.headers.location);
  if (!target.protocol) {
    // relative location header. This is incorrect but tolerated
    this.target = url.parse('http://' + this.target.hostname + res.headers.location);
    this.poll();
    return;
  }
  switch (target.protocol) {
    case 'http:':
      this.target = target;
      this.poll();
      break;
    case 'https:':
      this.request.abort();
      this.timer.stop();
      var elapsedTime = this.timer.getTime();
      // timeout for new poller must be deduced of already elapsed time
      var httpsPoller = new HttpsPoller(target, this.timeout - elapsedTime, this.callback);
      httpsPoller.poll();
      // already elapsed time must be added to the new poller elapsed time 
      httpsPoller.timer.time = httpsPoller.timer.time - elapsedTime;
      break;
    default:
      this.request.abort();
      this.onErrorCallback({ name: "WrongRedirectUrl", message: "Received redirection from http: to unsupported protocol " + target.protocol});
  }
  return;
};

HttpPoller.getDetailsForPollAndCheck = function(checkResponse, check) {
  var pattern = check.pollerParams ? check.pollerParams.match : null;
  if (!pattern) {
    return;
  }
  var patternParts = pattern.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));
  var regexp;
  try {
    regexp = new RegExp(patternParts[1], patternParts[2]);
  } catch (e) {
    throw new Error('Malformed pattern in check configuration: ' + pattern);
  }
  if (!checkResponse.body.match(regexp)) {
    throw new Error('Response body does not match pattern ' + pattern);
  }
  return;
};

HttpPoller.validateTarget = function(target) {
  return url.parse(target).protocol == 'http:';
};

module.exports = HttpPoller;
