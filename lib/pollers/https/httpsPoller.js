/**
 * Module dependencies.
 */

var util  = require('util');
var https = require('https');
var http  = require('http');
var url   = require('url');
var fs    = require('fs');
var ejs   = require('ejs');
var BaseHttpPoller = require('../http/baseHttpPoller');

// The http module lacks proxy support. Let's monkey-patch it.
require('../../proxy');

/**
 * HTTPS Poller, to check web pages served via SSL
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function HttpsPoller(target, timeout, callback) {
  HttpsPoller.super_.call(this, target, timeout, callback);
}

HttpsPoller.type = 'https';

util.inherits(HttpsPoller, BaseHttpPoller);

/**
 * Launch the actual polling
 *
 * @api   public
 */
HttpsPoller.prototype.poll = function(secure) {
  HttpsPoller.super_.prototype.poll.call(this);
  secure = typeof secure !== 'undefined' ? secure : true;
  try {
    if (secure) {
      this.request = https.get(this.target, this.onResponseCallback.bind(this));
    } else {
      this.request = http.get(this.target, this.onResponseCallback.bind(this));
    }
  } catch(err) {
    return this.onErrorCallback(err);
  }
  this.request.on('error', this.onErrorCallback.bind(this));
};

// see inherited function BaseHttpPoller.prototype.onResponseCallback
// see inherited function BaseHttpPoller.prototype.onErrorCallback

HttpsPoller.prototype.handleRedirectResponse = function(res) {
  this.debug(this.getTime() + "ms - Got redirect response to " + this.target.href);
  var target = url.parse(res.headers.location);
  if (!target.protocol) {
    // relative location header. This is incorrect but tolerated
    this.target = url.parse('http://' + this.target.hostname + res.headers.location);
    this.poll(false);
    return;
  }
  switch (target.protocol) {
    case 'https:':
      this.target = target;
      this.poll(true);
      break;
    case 'http:':
      this.target = target;
      this.poll(false);
      break;
    default:
      this.request.abort();
      this.onErrorCallback({ name: "WrongRedirectUrl", message: "Received redirection from https: to unsupported protocol " + target.protocol});
  }
  return;
};

HttpsPoller.validateTarget = function(target) {
  return url.parse(target).protocol == 'https:';
};

HttpsPoller.getDetailsEditPartial = function(options) {
  var template = fs.readFileSync(__dirname + '/../http/_detailsEdit.ejs', 'utf8');
  return ejs.render(template, options);
};

HttpsPoller.populateCheckFromRequest = function(checkDocument, dirtyCheck) {
  if (dirtyCheck.match) {
    var match = HttpsPoller.validateMatch(dirtyCheck.match);
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
HttpsPoller.validateMatch = function(match) {
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

module.exports = HttpsPoller;