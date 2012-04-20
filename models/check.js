var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var TimeCalculator = require('../lib/timeCalculator');
var async    = require('async');

// models dependencies
var Ping             = require('../models/ping');
var CheckEvent       = require('../models/checkEvent');
var CheckHourlyStat  = require('../models/checkHourlyStat');
var CheckDailyStat   = require('../models/checkDailyStat');
var CheckMonthlyStat = require('../models/checkMonthlyStat');

// main model
var Check = new Schema({
  name        : String,
  type        : String,
  url         : String,
  interval    : { type: Number, default: 60000 }, // interval between two pings
  maxTime     : { type: Number, default: 1500 },  // time under which a ping is considered responsive
  tags        : [String],
  lastChanged : Date,
  firstTested : Date,
  lastTested  : Date,
  isUp        : Boolean,
  isPaused    : { type:Boolean, default: false },
  uptime      : { type: Number, default: 0 },
  downtime    : { type: Number, default: 0 },
  qos         : {},
  qosPerHour  : {}
});
Check.plugin(require('../lib/lifecycleEventsPlugin'));

Check.pre('remove', function(next) {
  async.parallel([this.removePings.bind(this), this.removeEvents.bind(this), this.removeStats.bind(this)], function() {
    next();
  });
});

Check.methods.removePings = function(callback) {
  Ping.remove({ check: this._id }, callback);
};

Check.methods.removeEvents = function(callback) {
  CheckEvent.remove({ check: this._id }, callback);
}

Check.methods.removeStats = function(callback) {
  var self = this;
  async.parallel([
    function(cb) { CheckHourlyStat.remove({ check: self._id }, cb); },
    function(cb) { CheckDailyStat.remove({ check: self._id }, cb); },
    function(cb) { CheckMonthlyStat.remove({ check: self._id }, cb); }
  ], callback);
};

Check.methods.needsPoll = function() {
  if (this.isPaused) return false;
  if (!this.firstTested) return true;
  var delay = (this.lastTested.getTime() - this.firstTested.getTime()) % this.interval;
  return (Date.now() - this.lastTested.getTime() + delay) >= (this.interval || 60000);
}

Check.methods.togglePause = function() {
  this.isPaused = !this.isPaused;
}

Check.methods.setLastTest = function(status, time, error) {
  var now = time ? new Date(time) : new Date();
  if (!this.firstTested) this.firstTested = now;
  this.lastTested = now;
  if (this.isUp != status) {
    var event = new CheckEvent({
      timestamp: now,
      check: this,
      tags: this.tags,
      message: status ? 'up' : 'down',
      details: error
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

Check.methods.updateUptime = function(callback) {
  var self = this;
  Ping
  .findOne()
  .where('check', self)
  .desc('timestamp')
  .run(function(err, latestPing) {
    if (err) return callback(err);
    if (!latestPing) return;
    self.lastTested = latestPing.timestamp;
    self.isUp = latestPing.isUp;
    if (latestPing.isUp) {
      // check is up
      // lastChanged is the latest down ping
      self.downtime = 0;
      Ping
      .findOne()
      .where('check', self)
      .where('isUp', false)
      .where('timestamp').$lt(latestPing.timestamp)
      .desc('timestamp')
      .run(function(err, latestDownPing) {
        if (err) return callback(err);
        if (latestDownPing) {
          self.lastChanged = latestDownPing.timestamp;
          self.uptime = latestPing.timestamp.getTime() - latestDownPing.timestamp.getTime();
          self.save(callback);
        } else {
          // check never went down, last changed is the date of the first ping
          Ping
          .findOne()
          .where('check', self)
          .asc('timestamp')
          .run(function(err, firstPing) {
            if (err) return callback(err);
            self.lastChanged = firstPing.timestamp;
            self.uptime = latestPing.timestamp.getTime() - firstPing.timestamp.getTime();
            self.save(callback);
          });
        }
      });
    } else {
      // check is down
      // lastChanged is the latest up ping
      self.uptime = 0;
      Ping
      .findOne()
      .where('check', self)
      .where('isUp', true)
      .where('timestamp').$lt( latestPing.timestamp)
      .desc('timestamp')
      .run(function(err, latestUpPing) {
        if (err) return callback(err);
        if (latestUpPing) {
          self.lastChanged = latestUpPing.timestamp;
          self.downtime = latestPing.timestamp.getTime() - latestUpPing.timestamp.getTime();
          self.save(callback);
        } else {
          // check never went up, last changed is the date of the first ping
          Ping
          .findOne()
          .where('check', self)
          .asc('timestamp')
          .run(function(err, firstPing) {
            if (err) return callback(err);
            self.lastChanged = firstPing.timestamp;
            self.downtime = latestPing.timestamp.getTime() - firstPing.timestamp.getTime();
            self.save(callback);
          });
        }
      });
    }
  });
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
  if (typeof boundary == 'undefined') {
    return callback(new Error('unknown period type ' + period));
  }
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
          uptime: (stat.ups / stat.count * 100).toFixed(3),
          responsiveness: (stat.responsives / stat.count * 100).toFixed(3),
          downtime: stat.downtime / 1000,
          responseTime: Math.round(stat.time / stat.count)
        });
      };
    } else {
      callback(null, stats);
    }
  });
}

Check.statics.convertTags = function(tags) {
  if (typeof(tags) === 'string') {
    if (tags) {
      tags = tags.replace(/\s*,\s*/g, ',').split(',');
    } else {
      tags = [];
    }
  }
  return tags;
}

Check.statics.guessType = function(url) {
  if (url.search(/^http:\/\//) != -1) {
    return 'http';
  }
  if (url.search(/^https:\/\//) != -1) {
    return 'https';
  }
  if (url.search(/^udp:\/\//) != -1) {
    return 'udp';
  }
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
  return this.$where(Check.methods.needsPoll);
}

Check.statics.updateAllQos = function(callback) {
  this.find({}).each(function (err, check) {
    if(err || !check) return;
    check.updateQos(callback);
  });
}

module.exports = mongoose.model('Check', Check);