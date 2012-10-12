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
      var totalUptime = 0;
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
            totalUptime += currentPeriod[1] - currentPeriod[0];
            currentPeriod = [];
            isUp = false;
            break;
        }
      })
      if (isUp) {
        // check was up until the end
        currentPeriod.push(end.getTime ? end.getTime() : end);
        periods.push(currentPeriod);
        totalUptime += currentPeriod[1] - currentPeriod[0];
      };
      callback(null, periods, totalUptime);
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

/**
 * Flatten an array of periods array by merging the periods
 *
 * Input is an array of periods array
 * e.g. [ [[1, 2], [4, 5], [8, 9]], [[9, 11], [13, 14]], [[16, 18], [20, 21]], [[21, 22]] ]
 * the flattened return value merge adjacent periods
 * e.g. [ [1, 2], [4, 5], [8, 11], [13, 14], [16, 18], [20, 22] ]
 */
UptimeCalculator.flattenPeriods = function(periodsCollection) {
  var periods = [];
  var lastTime = -1;
  var newPeriods = periodsCollection.shift();
  while (newPeriods) {
    var firstPeriod = newPeriods.shift();
    var firstTime = firstPeriod[0];
    if (lastTime == firstTime) {
      periods[periods.length - 1][1] = firstPeriod[1];
    } else {
      periods = periods.concat([firstPeriod]);
    }
    if (newPeriods) {
      periods = periods.concat(newPeriods);
    }
    lastTime = periods[periods.length - 1][1];
    newPeriods = periodsCollection.shift();
  }
  return periods;
}

/**
 * Flatten an array of periods array by intersecting the periods
 *
 * Input is an array of periods array
 * e.g. [ [[1, 2], [4, 5], [8, 9]], [[1, 9]], [[1, 3], [4, 6], [8, 9]], [[1, 9]] ]
 * the flattened return value counts only uptime periods valid for all elements
 * e.g. [ [1, 2], [4, 5] ]
 */
UptimeCalculator.intersectPeriods = function(periodsCollection) {
}

module.exports = UptimeCalculator;