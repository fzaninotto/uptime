/**
 * Module dependencies.
 */

var util = require('util');
var http = require('http');
var url  = require('url');
var fs   = require('fs');
var ejs  = require('ejs');
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

HttpPoller.getDetailsEditPartial = function(options) {
  var template = fs.readFileSync(__dirname + '/_detailsEdit.ejs', 'utf8');
  return ejs.render(template, options);
};

HttpPoller.populateCheckFromRequest = function(checkDocument, dirtyCheck) {
  if (dirtyCheck.match) {
    var match = HttpPoller.validateMatch(dirtyCheck.match);
    if (!match) {
      throw new Error('Malformed regular expression ' + dirtyCheck.match);
    }
    checkDocument.setPollerParam('match', match);
  }
};

/**
 * Sanitizes and validates a given string to check that
 * it can be transformed to a regexp
 */
HttpPoller.validateMatch = function(match) {
  if (!match) return true;
  if (match.indexOf('/') !== 0) {
    match = '/' + match + '/';
  }
  var matchParts = match.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));
  try {
    // check that the regexp doesn't crash
    new RegExp(matchParts[1], matchParts[2]);
  } catch (e) {
    return false;
  }
  return match;
};

module.exports = HttpPoller;