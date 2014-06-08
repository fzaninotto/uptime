/**
 * Module dependencies.
 */

var util = require('util');
var url  = require('url');
var BasePoller = require('../basePoller');
var WebPageTest = require('webpagetest');
var config = require('config');

/**
 * WebPageTest Poller, to perform WebPageTest analysis on web pages
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function WebPageTestPoller(target, timeout, callback) {
  WebPageTestPoller.super_.call(this, target, timeout, callback);
}

util.inherits(WebPageTestPoller, BasePoller);

WebPageTestPoller.type = 'webpagetest';

WebPageTestPoller.validateTarget = function(target) {
  return url.parse(target).protocol == 'http:';
};

WebPageTestPoller.prototype.initialize = function() {
  this.timeout = 999999; // We can't know a test duration
  this.wpt = new WebPageTest(config.webPageTest.server || 'www.webpagetest.org', config.webPageTest.key);
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
WebPageTestPoller.prototype.poll = function() {
  WebPageTestPoller.super_.prototype.poll.call(this);
  this.debug('WebPageTest start test [target='+this.target+']');
  this.wpt.runTest(this.target, config.webPageTest.testOptions | {}, this.onTestStartedCallback.bind(this));
};

/**
 * Test started callback
 *
 * @api   private
 */
WebPageTestPoller.prototype.onTestStartedCallback = function(err,data){
  if (err) {
    console.log(err);
    this.timer.stop();
  } else {
    if (data.statusCode && data.statusCode == 200) {
      this.testId = data.data.testId;
      if (data.data.userUrl) {
        this.userUrl = data.data.userUrl;
      }
      this.debug('WebPageTest test started [testId='+this.testId+']');
      this.checkTestStatus();
    } else {
      return this.onErrorCallback({ name: "Test not started", message: data.statusText});
    }
  }
};

/**
 * TestStatus callback
 *
 * @api   private
 */
WebPageTestPoller.prototype.checkTestStatus = function(){
  var self = this;
  this.wpt.getTestStatus(this.testId, function(err, data) {
    if (err) {
      self.debug('WebPageTest checkTestStatus error');
      self.timer.stop();
      return;
    }
    if (data && data.statusCode == 200) {
      self.wpt.getTestResults(self.testId, function(err, data) {
        var docTime = parseInt(data.response.data.average.firstView.docTime, 10);
        self.debug('WebPageTestResults received [docTime=' + docTime + ']');
        self.timer.stop();
        if (self.userUrl) {
          self.callback(null, docTime, {}, { url: self.userUrl });
        } else {
          self.callback(null, docTime, {});
        }
      });
    } else {
      self.testStatusTimeout = setTimeout(self.checkTestStatus.bind(self), 5000);
    }
  });
};

/**
 * Timeout callback
 *
 * @api   private
 */
WebPageTestPoller.prototype.timeoutReached = function() {
  this.debug('WebPageTestPoller timeoutReached call');
  WebPageTestPoller.super_.prototype.timeoutReached.call(this);
  var self = this;
  if (typeof this.timeout !== undefined) {
    this.wpt.cancelTest(this.testId, function(err,data) {
      self.debug('WebPageTest test started [testId=' + self.testId + ']');
    });
  }
};

module.exports = WebPageTestPoller;
