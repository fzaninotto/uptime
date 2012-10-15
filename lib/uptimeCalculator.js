var Ping       = require('../models/ping');
var CheckEvent = require('../models/checkEvent');
var Intervals  = require('interval-query');

var UptimeCalculator = function(check) {
  this.check = check;
}

UptimeCalculator.prototype.getOutages = function(begin, end, callback) {
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
      var totalDowntime = 0;
      var isDown = ping ? !ping.isUp : false; // initial state
      var currentPeriod = isDown ? [begin.getTime ? begin.getTime() : begin] : [];
      checkEvents.forEach(function(checkEvent) {
        switch (checkEvent.message) {
          case 'up':
            if (!isDown) break; // check passes up while it was already up: ignore
            // end of an outage period
            currentPeriod.push(checkEvent.timestamp.getTime());
            periods.push(currentPeriod);
            totalDowntime += currentPeriod[1] - currentPeriod[0];
            currentPeriod = [];
            isDown = false;
            break;
          case 'down':
            if (isDown) break; // check passes down while it was already down: ignore
            // beginning of an outage period
            currentPeriod.push(checkEvent.timestamp.getTime());
            isDown = true;
            break;
        }
      })
      if (isDown) {
        // check was down until the end
        currentPeriod.push(end.getTime ? end.getTime() : end);
        periods.push(currentPeriod);
        totalDowntime += currentPeriod[1] - currentPeriod[0];
      };
      callback(null, periods, totalDowntime);
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
 * Input is an array of consecutive (never overlapping) periods array, the flattened return value merges adjacent periods
 *
 * Example:
 * flattenPeriods([ [[1, 2], [4, 5], [8, 9]], [[9, 11], [13, 14]], [[16, 18], [20, 21]], [[21, 22]] ])
 *   => [ [1, 2], [4, 5], [8, 11], [13, 14], [16, 18], [20, 22] ]
 */
UptimeCalculator.mergeConsecutivePeriods = function(periodsCollection) {
  var periods = [];
  var lastTime = -1;
  var newPeriods, firstPeriod;
  while (periodsCollection.length > 0) {
    newPeriods = periodsCollection.shift();
    if (!newPeriods.length) continue;
    firstPeriod = newPeriods.shift();
    if (lastTime == firstPeriod[0]) {
      periods[periods.length - 1][1] = firstPeriod[1];
    } else {
      periods = periods.concat([firstPeriod]);
    }
    if (newPeriods) {
      periods = periods.concat(newPeriods);
    }
    lastTime = periods[periods.length - 1][1];
  }
  return periods;
}

/**
 * Negate an array of periods between two boundaries
 *
 * Input is an ordered list of periods
 *
 * Example:
 * negatePeriods(1, 10, [[1, 2], [4, 5], [8, 9]])
 *   => [ [2, 4], [5, 8], [9, 10] ]
 */

UptimeCalculator.negatePeriods = function(begin, end, periods) {
  if (periods.length == 0) {
    return [[begin, end]];
  }
  var lastTime = begin;
  var negatedPeriods = [];
  var period;
  while (periods.length > 0) {
    period = periods.shift();
    if (lastTime != period[0]) {
      negatedPeriods.push([lastTime, period[0]]);
    }
    lastTime = period[1];
  }
  if (lastTime != end) {
    negatedPeriods.push([lastTime, end]);
  }
  return negatedPeriods;
}

/**
 * Flatten an array of periods array by merging the periods
 *
 * Input is an array of periods array, the flattened return value counts only uptime periods valid for any element
 * 
 * Example:
 * mergePeriods([ [[1, 2], [4, 5], [8, 9]], [[1, 3], [4, 6], [8, 9]], [[4, 10]] ])
 *   => [ [1, 3], [4, 10] ]
 */
UptimeCalculator.mergePeriods = function(periodsCollection) {
  if (periodsCollection.length == 0) {
    return [];
  }
  if (periodsCollection.length == 1) {
    return periodsCollection[0];
  }
  var self = this;
  var tree = new Intervals.SegmentTree;
  tree.clearIntervalStack();
  periodsCollection.forEach(function(periods) {
    periods.forEach(function(period) {
      if (!period.length) return;
      tree.pushInterval(period[0], period[1]);
    });
  });
  if (tree._intervals.length == 0) {
    return [];
  }
  tree.buildTree();
  var periods = [];
  var mergedIntervals = [];
  var intervals = tree.queryOverlap();
  var overlapperKey, period;
  intervals.forEach(function(interval, key) {
    period = [interval.from, interval.to];
    while (interval.overlap.length > 0) {
      overlapperKey = interval.overlap.shift() - 1;
      if (overlapperKey <= key || !intervals[overlapperKey]) continue; // already merged
      period = self.mergeOverlappingPeriods(period, [intervals[overlapperKey].from, intervals[overlapperKey].to]);
      interval.overlap = interval.overlap.concat(intervals[overlapperKey].overlap);
      delete intervals[overlapperKey];
    }
    periods.push(period);
  });
  periods.sort(function(a, b) {
    return a[0] - b[0];
  })
  return periods;
}

/**
 * Merge two overlapping periods and returns the merged period
 *
 * Example:
 * mergeOverlappingPeriods([1, 5], [3, 7])
 *   => [1, 7]
 */
UptimeCalculator.mergeOverlappingPeriods = function(period1, period2) {
  return [Math.min(period1[0], period2[0]), Math.max(period1[1], period2[1])];
}

/**
 * Flatten an array of periods array by intersecting the periods
 *
 * Input is an array of periods array, the flattened return value counts only uptime periods valid for all elements. This method achieves intersection by negating the merge of negated periods.
 * 
 * Example:
 * intersectPeriods([ [[1, 2], [4, 5], [8, 9]], [[1, 9]], [[1, 3], [4, 6], [8, 9]], [[1, 9]] ])
 *   => [ [1, 2], [4, 5] ]
 */
UptimeCalculator.intersectPeriods = function(begin, end, periodsCollection) {
  if (periodsCollection.length == 0) {
    return [];
  }
  if (periodsCollection.length == 1) {
    return periodsCollection[0];
  }
  var self = this;
  var periods = [];
  periodsCollection.forEach(function(periods, key) {
    periodsCollection[key] = self.negatePeriods(begin, end, periods);
  });
  periodsCollection = self.mergePeriods(periodsCollection)
  return self.negatePeriods(begin, end, periodsCollection);
}

UptimeCalculator.computeDowntime = function(outages) {
  var downtime = 0;
  outages.forEach(function(period) {
    downtime += period[1] - period[0];
  });
  return downtime;
}

module.exports = UptimeCalculator;