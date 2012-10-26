var async = require('async');
var CheckEvent = require('../models/checkEvent');

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
};

IntervalBuilder.prototype.addTarget = function(objectId) {
  this.objectIds.push(objectId._id ? objectId._id : objectId);
  this.nbObjects++;
}

IntervalBuilder.prototype.build = function(begin, end, callback) {
  var self = this;
  async.series([
    function(next) { self.determineInitialState(begin, next); },
    function(next) { self.buildIntervalsForPeriod(begin, end, next); },
  ], function(err) {
    if (err) return callback(err);
    self.completeCurrentInterval(end);
    return callback(null, self.intervals, self.downtime);
  });
}

IntervalBuilder.prototype.isMultiTarget = function() {
  return this.nbObjects > 1;
}

IntervalBuilder.prototype.determineInitialState = function(timestamp, callback) {
  var self = this;
  async.forEach(this.objectIds, function(objectId, next) {
    CheckEvent.find()
    .where('check').equals(objectId)
    .where('timestamp').lte(timestamp)
    .sort({ timestamp: -1 })
    .findOne(function(err, checkEvent) {
      if (err) return next(err);
      if (!checkEvent) {
        // No ping ever - start the period as paused
        self.addEvent(objectId, 'paused', timestamp);
        return next();
      }
      self.addEvent(objectId, checkEvent.message);
      next();
    });
  }, function(err) {
    if (err) return callback(err);
    self.updateCurrentState(timestamp);
    return callback();
  });
}

IntervalBuilder.prototype.buildIntervalsForPeriod = function(begin, end, callback) {
  var self = this;
  CheckEvent.find()
  .where('check').in(this.objectIds)
  .where('timestamp').gt(begin).lte(end)
  .sort({ timestamp: 1 })
  .find(function(err, checkEvents) {
    if (err) return callback(err);
    checkEvents.forEach(function(checkEvent) {
      if (self.addEvent(checkEvent.check, checkEvent.message)) {
        self.updateCurrentState(checkEvent.timestamp);
      }
    });
    callback();
  });
}

/**
 * Add an event for a given check.
 *
 * Returns true if the event modifies the state of a given check, false otherwise
 */
IntervalBuilder.prototype.addEvent = function(objectId, message) {
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
}

/**
 * Return true if the global state was updated, false otherwise.
 */
IntervalBuilder.prototype.updateCurrentState = function(timestamp) {
  timestamp = this.getTimestamp(timestamp);
  var currentState = this.getGlobalState();
  if (currentState !== this.currentState) {
    this.completeCurrentInterval(timestamp);
    this.currentInterval = currentState == 1 ? [] : [timestamp];
    this.currentState = currentState;
    return true;
  }
  return false;
}

IntervalBuilder.prototype.getGlobalState = function() {
  var ups = 0;
  var paused = 0;
  for (var objectId in this.states) {
    if (this.isUp(objectId)) ups++;
    if (this.isPaused(objectId)) paused++;
  }
  if (!this.isMultiTarget() && paused > 0) {
    return PAUSED; // global state is paused because there is only one check
  }
  if ((ups + paused) == this.nbObjects) {
    return UP; // ignore paused in multiTarget
  }
  return DOWN; // at least one of the targets is paused
}

IntervalBuilder.prototype.isUp = function(objectId) {
  return this.states[objectId] == UP;
}

IntervalBuilder.prototype.isDown = function(objectId) {
  return this.states[objectId] == DOWN;
}

IntervalBuilder.prototype.isPaused = function(objectId) {
  return this.states[objectId] == PAUSED;
}

IntervalBuilder.prototype.getTimestamp = function(date) {
  return date.valueOf ? date.valueOf() : date;
}

IntervalBuilder.prototype.completeCurrentInterval = function(timestamp) {
  if (this.currentInterval.length != 1) {
    // no current interval - ignore
    return false;
  }
  if (this.currentState == DOWN) {
    this.downtime += timestamp - this.currentInterval[0];
  }
  this.intervals.push(this.currentInterval.concat([timestamp, this.currentState]));
  return true;
}

module.exports = IntervalBuilder;