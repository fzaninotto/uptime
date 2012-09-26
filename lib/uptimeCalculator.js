var Ping       = require('../models/ping');
var CheckEvent = require('../models/checkEvent');

var UptimeCalculator = function(check) {
  this.check = check;
}

UptimeCalculator.prototype.getUptimePeriods = function(begin, end, callback) {
  var self = this;
  this.getPingBeforeTime(begin, function(err1, ping) {
    if (err1) return callback(err1);
    CheckEvent.find()
    .where('check').equals(self.check)
    .where('timestamp').gte(begin).lte(end)
    .sort({ timestamp: 1 })
    .find(function(err2, checkEvents) {
      if (err2) return callback(err2);
      var periods = [];
      var isUp = ping ? ping.isUp : false; // initial state
      var currentPeriod = isUp ? [begin.getTime ? begin.getTime() : begin] : [];
      checkEvents.forEach(function(checkEvent) {
        switch (checkEvent.message) {
          case 'up':
            if (isUp) break; // check passes up while it was already up: ignore
            // beginning of an uptime period
            currentPeriod.push(checkEvent.timestamp.getTime());
            isUp = true;
            break;
          case 'down':
            if (!isUp) break; // check passes down while it was already down: ignore
            // end of an uptime period
            currentPeriod.push(checkEvent.timestamp.getTime());
            periods.push(currentPeriod);
            currentPeriod = [];
            isUp = false;
            break;
        }
      })
      if (isUp) {
        // check was up until the end
        currentPeriod.push(end.getTime ? end.getTime() : end);
        periods.push(currentPeriod);
      };
      callback(null, periods);
    });
  });
}

/**
 * Get the last ping preceding a given timestamp
 *
 * This determines the state of a check at a given time.
 *
 * @api   public
 */
UptimeCalculator.prototype.getPingBeforeTime = function(timestamp, callback) {
  Ping.find()
  .where('check').equals(this.check)
  .where('timestamp').lte(timestamp)
  .sort({ timestamp: -1 })
  .findOne(callback);
}

module.exports = UptimeCalculator;