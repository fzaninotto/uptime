var mongoose = require('mongoose'),
    Schema   = mongoose.Schema,
    TimeCalculator = require('../lib/timeCalculator'),
    async    = require('async');

// models dependencies
var Ping             = require('../models/ping');
var CheckEvent       = require('../models/checkEvent');
var CheckHourlyStat  = require('../models/checkHourlyStat');
var CheckDailyStat   = require('../models/checkDailyStat');
var CheckMonthlyStat = require('../models/checkMonthlyStat');

// main model
var Check = new Schema({
    name        : String
  , url         : String
  , interval    : { type: Number, default: 60000 }  // interval between two pings
  , maxTime     : { type: Number, default: 1500 }   // time under which a ping is considered responsive
  , tags        : [String]
  , lastChanged : Date
  , lastTested  : Date
  , isUp        : Boolean
  , uptime      : { type: Number, default: 0 }
  , downtime    : { type: Number, default: 0 }
  , qos         : {}
  , qosPerHour  : {}
});

Check.pre('remove', function(next) {
  this.removePings(function() {
    next();
  });
});

Check.pre('remove', function(next) {
  this.removeStats(function() {
    next();
  });
});

Check.methods.removePings = function(callback) {
  Ping.find({ check: this._id }).remove(callback);
};

Check.methods.removeStats = function(callback) {
  var self = this;
  async.parallel([
    function(cb) { CheckHourlyStat.find({ check: self._id }).remove(cb); },
    function(cb) { CheckDailyStat.find({ check: self._id }).remove(cb); },
    function(cb) { CheckMonthlyStat.find({ check: self._id }).remove(cb); }
  ], callback);
};

Check.methods.setLastTest = function(status) {
  var now = new Date();
  if (this.isUp != status) {
    var event = new CheckEvent({
      timestamp: now,
      check: this,
      tags: this.tags,
      isGoDown: this.isUp,
    });
    if (status && this.lastChanged) {
      event.downtime = now.getTime() - this.lastChanged.getTime();
    }
    event.save();
    this.lastChanged = now;
    this.isUp = status;
    this.uptime = 0;
    this.downtime = 0;
  }
  var durationSinceLastChange = now.getTime() - this.lastChanged.getTime();
  if (status) {
    this.uptime = durationSinceLastChange;
  } else {
    this.downtime = durationSinceLastChange;
  }
  return this;
}

Check.methods.getQosPercentage = function() {
  if (!this.qos) return false;
  return (this.qos.ups / this.qos.count) * 100;
}

Check.methods.updateQos = function(callback) {
  var check = this;
  Ping.countForCheck(check, new Date(Date.now() - (24 * 60 * 60 * 1000)), new Date(), function(err, result) {
    if (err || !(0 in result)) return;
    check.qos = result[0].value;
    check.markModified('qos');
    check.save(callback);
  });
}

var statProvider = {
  '1h':  'Ping',
  '6h':  'Ping',
  '1d':  'CheckHourlyStat',
  '7d':  'CheckHourlyStat',
  'MTD': 'CheckDailyStat',
  '1m':  'CheckDailyStat',
  '3m':  'CheckDailyStat',
  '6m':  'CheckMonthlyStat',
  'YTD': 'CheckMonthlyStat',
  '1y':  'CheckMonthlyStat',
  '3y':  'CheckMonthlyStat'
};

Check.methods.getStatsForPeriod = function(period, page, callback) {
  var boundary = TimeCalculator.boundaryFunction[period];
  var stats = [];
  var query = { check: this, timestamp: { $gte: boundary(page), $lte: boundary(page - 1) } };
  this.db.model(statProvider[period]).find(query).asc('timestamp').each(function(err, stat) {
    if (stat) {
      if (typeof stat.isUp != 'undefined') {
        // stat is a Ping
        stats.push({
          timestamp: Date.parse(stat.timestamp),
          uptime: stat.isUp ? 100 : 0,
          responsiveness: stat.isResponsive ? 100 : 0,
          downtime: stat.downtime ? stat.downtime / 1000 : 0,
          responseTime: Math.round(stat.time)
        });
      } else {
        // stat is an aggregation
        stats.push({
          timestamp: Date.parse(stat.timestamp),
          uptime: (stat.ups / stat.count).toFixed(5) * 100,
          responsiveness: (stat.responsives / stat.count).toFixed(5) * 100,
          downtime: stat.downtime / 1000,
          responseTime: Math.round(stat.time / stat.count)
        });
      };
    } else {
      callback(stats);
    }
  });
}

Check.statics.convertTags = function(tags) {
  if (typeof(tags) === 'string') {
    tags = tags.replace(/\s*,\s*/g, ',').split(',');
  }
  return tags;
}

/**
 * Calls a function for all checks that need to be polled.
 *
 * A check needs to be polled if it was last polled sine a longer time than its own interval.
 * This method uses Mongoose streaming cursor interface (Query.each())
 *
 * @param {Function} Callback function to be called with each Check
 * @api   public
 */
Check.statics.callForChecksNeedingPoll = function(callback) {
  this.needingPoll().each(callback);
}

Check.statics.needingPoll = function() {
  return this.$where(function() {
    return !this.lastTested || (Date.now() - this.lastTested.getTime()) > (this.interval || 60000);
  });
}

Check.statics.updateAllQos = function(callback) {
  this.find({}).each(function (err, check) {
    if(err || !check) return;
    check.updateQos(callback);
  });
}

module.exports = mongoose.model('Check', Check);
