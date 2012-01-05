/**
 * Module dependencies.
 */
var poller = require('./poller'),
    Target = require('../models/target').Target,
    Ping   = require('../models/ping').Ping;

/**
 * Monitor constructor
 *
 * @param {Number} Interval between each poll for a given target in milliseconds, defaults to 1 minute
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
 * Start the monitoring of all targets.
 *
 * The polling actually starts after the pollingInterval set to the constructor.
 *
 * @api   public
 */
Monitor.prototype.start = function() {
  this.intervalForPoll   = setInterval(this.pollAllTargets.bind(this), this.pollingInterval);
  this.intervalForUpdate = setInterval(this.updateAllTargets.bind(this), this.updateInterval);
}

/**
 * Stop the monitoring of all targets
 *
 * @api   public
 */
Monitor.prototype.stop = function() {
  clearInterval(this.intervalForPoll);
  clearInterval(this.intervalForUpdate);
}

/**
 * Poll all targets once
 *
 * @api   private
 */
Monitor.prototype.pollAllTargets = function() {
  var monitor = this;
  Target.find({}).each(function (err, target) {
    if (err || !target) return;
    p = poller.createPoller(target.url, function(time) {
      if (target.isUp) {
        now = new Date();
        console.log(now.toLocaleString() + ' ' + target.url + ' goes DOWN');
      }
      Ping.createForTarget(target, false, time);
      target.setLastTest(Date.now(), false).save();
    }, function(time) {
      if (!target.isUp) {
        now = new Date();
        console.log(now.toLocaleString() + ' ' + target.url + ' is back UP');
      }
      Ping.createForTarget(target, true, time);
      target.setLastTest(Date.now(), true).save();
    });
    p.timeout = monitor.timeout;
    //p.setDebug(true);
    p.poll();
  });
}

/**
 * Update the QoS scores for each target once
 * 
 * @api private
 */
Monitor.prototype.updateAllTargets = function() {
  Target.updateAllQos.apply(Target);
}

/**
 * Create a monitor to poll all targets at a given interval.
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
