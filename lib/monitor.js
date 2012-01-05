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
 * @api   public
 */
function Monitor(pollingInterval, updateInterval) {
  this.pollingInterval = (typeof pollingInterval == 'undefined') ? 60000 : pollingInterval;
  this.updateInterval = (typeof updateInterval == 'undefined') ? 300000 : updateInterval;
}

/**
 * Start the monitoring of all targets.
 *
 * The polling actually starts after the pollingInterval set to the constructor.
 *
 * @api   public
 */
Monitor.prototype.start = function() {
  this.intervalForPoll   = setInterval(this.pollAllTargets, this.pollingInterval);
  this.intervalForUpdate = setInterval(this.updateAllTargets, this.updateInterval);
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
  Target.find({}, function (err, docs) {
    if (err) console.dir(err);
    docs.forEach(function(doc) {
      p = poller.createPoller(doc.url, function() {
        console.log(doc.url + ' is DOWN');
        Ping.createForTarget(doc, false);
        doc.setLastTest(Date.now(), false).save();
      }, function() {
        console.log(doc.url + ' is UP');
        Ping.createForTarget(doc, true);
        doc.setLastTest(Date.now(), true).save();
      });
      p.setTimeout(doc.timeout);
      //p.setDebug(true);
      p.poll();
    });
  });
}

/**
 * Update the QoS scores for each target once
 * 
 * @api private
 */
Monitor.prototype.updateAllTargets = function() {
  console.log('Updating QoS scores');
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
 * @api   public
 */
exports.createMonitor = function(pollingInterval, updateInterval) {
  return new Monitor(pollingInterval, updateInterval);
}
