/**
 * Module dependencies.
 */
var poller = require('./poller'),
    Target = require('../models/target').Target,
    Ping   = require('../models/ping').Ping;

/**
 * Monitor constructor
 *
 * @param {Number} Polling interval in milliseconds
 * @api   public
 */
function Monitor(pollingInterval) {
  this.pollingInterval = (typeof pollingInterval == 'undefined') ? 60000 : pollingInterval;
}

/**
 * Start the monitoring of all targets.
 *
 * The polling actually starts after the pollingInterval set to the constructor.
 *
 * @api   public
 */
Monitor.prototype.start = function() {
  this.interval = setInterval(this.pollAll, this.pollingInterval);
}

/**
 * Stop the monitoring of all targets
 *
 * @api   public
 */
Monitor.prototype.stop = function() {
  clearInterval(this.interval);
}

/**
 * Poll all targets once
 *
 * @api   private
 */
Monitor.prototype.pollAll = function() {
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
 * @api   public
 */
exports.createMonitor = function(pollingInterval) {
  return new Monitor(pollingInterval);
}