/**
 * Module dependencies.
 */
var poller = require('./poller'),
    Check = require('../models/check').Check,
    Ping   = require('../models/ping').Ping;

/**
 * Monitor constructor
 *
 * @param {Number} Interval between each poll for a given check in milliseconds, defaults to 1 minute
 * @param {Number} Interval between each update of the QoS score in milliseconds, defaults to 5 minutes
 * @param {Number} Request timeout in milliseconds, defaults to 5 seconds
 * @api   public
 */
function Monitor(pollingInterval, updateInterval, timeout) {
  this.pollingInterval = (typeof pollingInterval == 'undefined') ? 60000 : pollingInterval;
  this.updateInterval = (typeof updateInterval == 'undefined') ? 300000 : updateInterval;
  this.timeout = (typeof timeout == 'undefined') ? 5000 : timeout;
}

/**
 * Start the monitoring of all checks.
 *
 * The polling actually starts after the pollingInterval set to the constructor.
 *
 * @api   public
 */
Monitor.prototype.start = function() {
  this.intervalForPoll   = setInterval(this.pollAllChecks.bind(this), this.pollingInterval);
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
 * Poll all checks once
 *
 * @api   private
 */
Monitor.prototype.pollAllChecks = function() {
  var monitor = this;
  Check.find({}).each(function (err, check) {
    if (err || !check) return;
    p = poller.createPoller(check.url, function(time) {
      if (check.isUp) {
        now = new Date();
        console.log(now.toLocaleString() + ' ' + check.url + ' goes DOWN');
      }
      Ping.createForCheck(check, false, time);
      check.setLastTest(Date.now(), false).save();
    }, function(time) {
      if (!check.isUp) {
        now = new Date();
        console.log(now.toLocaleString() + ' ' + check.url + ' is back UP');
      }
      Ping.createForCheck(check, true, time);
      check.setLastTest(Date.now(), true).save();
    });
    p.timeout = monitor.timeout;
    //p.setDebug(true);
    p.poll();
  });
}

/**
 * Update the QoS scores for each check once
 * 
 * @api private
 */
Monitor.prototype.updateAllChecks = function() {
  Check.updateAllQos.apply(Check);
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
