var async = require('async');
var CheckEvent = require('../models/checkEvent');
var Check = require('../models/check');

var PAUSED = -1;
var DOWN = 0;
var UP = 1;

/*
 * Usage:
 *   var builder = new IntervalBuilder();
 *   builder.addTarget(check1);
 *   builder.addTarget(check2);
 *   builder.build(begin, end, function(err, intervals, downtime) {
 *     // do things
 *   });
 */
var IntervalBuilder = function() {
  this.objectIds = [];
  this.nbObjects = 0;
  this.states = {};
  this.intervals = []; // intervals are [begin, end, state]
  this.currentState = null;
  this.currentInterval = [];
  this.downtime = 0;
  this.duration = 0;
  // constants
  this.PAUSED = PAUSED;
  this.DOWN = DOWN;
  this.UP = UP;
};

IntervalBuilder.prototype.addTarget = function(objectId) {
  this.objectIds.push(objectId._id ? objectId._id : objectId);
  this.nbObjects++;
};

IntervalBuilder.prototype.isEmpty = function() {
  return this.nbObjects === 0;
};

IntervalBuilder.prototype.isMultiTarget = function() {
  return this.nbObjects > 1;
};

/**
 * Add an event for a given check.
 *
 * Returns true if the event modifies the state of a given check, false otherwise
 */
IntervalBuilder.prototype.changeObjectState = function(objectId, message) {
  switch (message) {
    case 'up':
      if (!this.isUp(objectId)) {
        this.states[objectId] = UP;
        return true;
      }
      break;
    case 'down':
      if (!this.isDown(objectId)) {
        this.states[objectId] = DOWN;
        return true;
      }
      break;
    case 'paused':
    case 'restarted':
    default:
      if (!this.isPaused(objectId)) {
        this.states[objectId] = PAUSED;
        return true;
      }
      break;
  }
  return false;
};

IntervalBuilder.prototype.isUp = function(objectId) {
  return this.states[objectId] == UP;
};

IntervalBuilder.prototype.isDown = function(objectId) {
  return this.states[objectId] == DOWN;
};

IntervalBuilder.prototype.isPaused = function(objectId) {
  return this.states[objectId] == PAUSED;
};

IntervalBuilder.prototype.build = function(begin, end, callback) {
  var self = this;

  async.auto({
    initialState: function(next) {
        self.determineInitialState(begin, next);
    },
    interval: ['initialState', function(next) {
        self.buildIntervalsForPeriod(begin, end, next);
    }],
    check: ['initialState', 'interval', function (next) {
        self.getCurrentCheck(next)
    }],
    duration: ['initialState', 'interval', 'check', function (next, results) {
        self.calculateDuration(results.check, begin, end, next);
    }],
    downtime: ['initialState', 'interval', 'check', 'duration', function (next, results) {
        self.calculateDowntime(results.check, begin, end, next);
    }]
    }, function(err, results) {
      if (err) {
        return callback(err);
      }

      self.duration = results.duration;
      self.downtime = results.downtime;

      return callback(null, self.intervals, self.downtime, self.duration);
  });
};

IntervalBuilder.prototype.getCurrentCheck = function(callback) {
  Check.findOne({ _id: this.objectIds[0] }, callback);
};

IntervalBuilder.prototype.determineInitialState = function(timestamp, callback) {
  var self = this;

  // find the first event before the timestamp for a given check
  var getInitialEvent = function(checkId, timestamp, callback) {
    CheckEvent.find()
    .where('check').equals(checkId)
    .where('timestamp').lte(timestamp)
    .sort({ timestamp: -1 })
    .findOne(function(err, checkEvent) {
      if (err) return callback(err);
      if (!checkEvent) {
        // No ping ever - start the period as paused
        return callback(null, 'paused');
      }
      callback(null, checkEvent.message);
    });
  };

  // set initial state for all checks
  async.forEach(this.objectIds, function(objectId, next) {
    getInitialEvent(objectId, timestamp, function(err, state) {
      if (err) return next(err);
      self.changeObjectState(objectId, state);
      next();
    });
  }, function(err) {
    if (err) return callback(err);
    self.setGlobalStateAtTime(self.getGlobalState(), timestamp);
    return callback(null, self.currentState);
  });
};

/**
 * Get the current state. If there is only one target, it's the target state.
 * Otherwise, the global state is:
 *  - down when at least one target is down
 *  - paused when all targets are paused
 *  - up otherwise
 */
IntervalBuilder.prototype.getGlobalState = function() {
  if (!this.isMultiTarget()) {
    return this.states[this.objectIds[0]];
  }
  var paused = 0;
  for (var objectId in this.states) {
    if (this.isDown(objectId)) return DOWN; // at least one of the targets is down
    if (this.isPaused(objectId)) paused++;
  }
  // multi-target states are paused only if all checks are paused
  return paused === this.nbObjects ? PAUSED : UP;
};

/**
 * Set the global state for a given time, and update intervals if it's 
 * different than the previous state.
 *
 * Return true if the global state was updated, false otherwise.
 */
IntervalBuilder.prototype.setGlobalStateAtTime = function(globalState, timestamp) {
  if (globalState === this.currentState) {
    return false;
  }
  timestamp = this.getTimestamp(timestamp);
  // complete the previous interval
  this.completeCurrentInterval(timestamp);
  // start a new interval
  this.currentInterval = (globalState == UP) ? [] : [timestamp];
  this.currentState = globalState;
  return true;
};

IntervalBuilder.prototype.completeCurrentInterval = function(timestamp) {
  if (this.currentInterval.length != 1) {
    // no current interval - ignore
    return false;
  }
  this.intervals.push(this.currentInterval.concat([timestamp, this.currentState]));
  return true;
};

IntervalBuilder.prototype.buildIntervalsForPeriod = function(begin, end, callback) {
  var self = this;
  CheckEvent.find()
  .where('check').in(this.objectIds)
  .where('timestamp').gt(begin).lte(end)
  .sort({ timestamp: 1 })
  .find(function(err, checkEvents) {
    if (err) return callback(err);
    checkEvents.forEach(function(checkEvent) {
      if (self.changeObjectState(checkEvent.check, checkEvent.message)) {
        self.setGlobalStateAtTime(self.getGlobalState(), checkEvent.timestamp);
      }
    });
    self.completeCurrentInterval(end);
    callback(null);
  });
};

IntervalBuilder.prototype.calculateDuration = function(check, begin, end, callback) {
  var durationBegin = Math.max(begin, check.firstTested),
    durationEnd = Math.min(end, check.lastTested),
    duration = durationEnd - durationBegin;

  if (this.isMultiTarget()) {
    // it's a tag - no other way
    return callback(null, duration);
  }

  this.intervals.forEach(function(interval) {
    if (interval[2] != PAUSED || interval[1] < durationBegin || interval[0] > durationEnd) {
      return;
    }

    var effectiveBegin = Math.max(durationBegin, interval[0]),
        effectiveEnd = Math.min(durationEnd, interval[1]);

    duration -= effectiveEnd - effectiveBegin;
  });

  return callback(null, duration);
};

IntervalBuilder.prototype.calculateDowntime = function(check, begin, end, callback) {
  var durationBegin = Math.max(begin, check.firstTested);
  var durationEnd = Math.min(end, check.lastTested);

  if (this.isMultiTarget()) {
    // it's a tag - no other way
    return callback(null, this.currentState == DOWN ? durationEnd - durationBegin : 0);
  }

  var downtime = 0;
  var currentIntervalEnd = null;
  this.intervals.forEach(function(interval) {
    currentIntervalEnd = interval[1];
    if (interval[2] != DOWN || interval[1] < durationBegin || interval[0] > durationEnd) {
      return true; // will act as a continue
    }

    var effectiveBegin = Math.max(durationBegin, interval[0]),
        effectiveEnd = Math.min(durationEnd, interval[1]);

    downtime += effectiveEnd - effectiveBegin;
  });

  if (!check.isUp) {
    if(currentIntervalEnd === null) {
      downtime += durationEnd - durationBegin;
    }else {
      downtime += durationEnd - currentIntervalEnd;
    }
  }

  return callback(null, downtime);
};

IntervalBuilder.prototype.getTimestamp = function(date) {
  return date.valueOf ? date.valueOf() : date;
};

module.exports = IntervalBuilder;
