/**
 * Module dependencies.
 */
var poller = require('./poller'),
    Check = require('../models/check'),
    Ping   = require('../models/ping');

/**
 * Monitor constructor
 *
 * @param {Number} Interval between each poll in milliseconds, defaults to 10 seconds
 * @param {Number} Interval between each update of the QoS score in milliseconds, defaults to 1 minute
 * @param {Number} Request timeout in milliseconds, defaults to 5 seconds
 * @api   public
 */
function Monitor(pollingInterval, updateInterval, timeout) {
  this.pollingInterval = (typeof pollingInterval == 'undefined') ? 10000 : pollingInterval;
  this.updateInterval = (typeof updateInterval == 'undefined') ? 60000 : updateInterval;
  this.timeout = (typeof timeout == 'undefined') ? 5000 : timeout;
  this.proxy = {};
}

/**
 * Start the monitoring of all checks.
 *
 * The polling actually starts after the pollingInterval set to the constructor.
 *
 * @api   public
 */
Monitor.prototype.start = function() {
  // start polling right away
  this.pollChecksNeedingPoll();
  // schedule future polls
  this.intervalForPoll   = setInterval(this.pollChecksNeedingPoll.bind(this), this.pollingInterval);
  // schedule updates
  this.intervalForUpdate = setInterval(this.updateAllChecks.bind(this), this.updateInterval);
}

/**
 * Stop the monitoring of all checks
 *
 * @api   public
 */
Monitor.prototype.stop = function() {
  clearInterval(this.intervalForPoll);
  clearInterval(this.intervalForUpdate);
}

/**
 * Find checks that need to be polled.
 *
 * A check needs to be polled if it was last polled sine a longer time than its own interval.
 *
 * @param {Function} Callback function to be called with each Check
 * @api   private
 */
Monitor.prototype.pollChecksNeedingPoll = function() {
  Check.callForChecksNeedingPoll(this.pollCheck.bind(this));
}

/**
 * Poll a given check, and create a ping according to the result.
 *
 * This method can be called by Mongoose streaming cursor interface, therefore check can be undefined.
 *
 * @api   private
 */
Monitor.prototype.pollCheck = function (err, check) {
  if (err || !check) return;
  check.lastTested = new Date();
  check.save();
  p = poller.createPoller(check.url, function(time, error) {
    if (check.isUp) {
      now = new Date();
      console.log(now.toLocaleString() + ' ' + check.url + ' goes DOWN');
    }
    Ping.createForCheck(check, false, time, error);
  }, function(time) {
    if (!check.isUp) {
      now = new Date();
      console.log(now.toLocaleString() + ' ' + check.url + ' is back UP');
    }
    Ping.createForCheck(check, true, time);
  });
  p.timeout = this.timeout;
  if (this.proxy.host) {
    p.proxy = this.proxy; 
  }
  //p.setDebug(true);
  p.poll();
}

/**
 * Update the QoS scores for each check once
 * 
 * @api private
 */
Monitor.prototype.updateAllChecks = function() {
  Ping.updateLast24HoursQos.apply(Ping);
  Ping.updateLastHourQos.apply(Ping);
}

/**
 * Create a monitor to poll all checks at a given interval.
 * 
 * Example:
 *
 *    m = monitor.createMonitor(60000);
 *    m.start();
 *    // the polling starts, every 60 seconds
 *    m.stop();
 *
 * @param {Number} Polling interval in milliseconds
 * @param {Number} Update interval in milliseconds
 * @param {Number} Request timeout in milliseconds
 * @api   public
 */
exports.createMonitor = function(pollingInterval, updateInterval, timeout) {
  return new Monitor(pollingInterval, updateInterval, timeout);
}
