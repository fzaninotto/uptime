var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var moment   = require('moment');
var async    = require('async');

// models dependencies
var Ping             = require('../models/ping');
var CheckEvent       = require('../models/checkEvent');
var CheckHourlyStat  = require('../models/checkHourlyStat');
var CheckDailyStat   = require('../models/checkDailyStat');
var CheckMonthlyStat = require('../models/checkMonthlyStat');
var CheckYearlyStat  = require('../models/checkYearlyStat');
var Tag              = require('../models/tag');

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
  isPaused    : { type: Boolean, default: false },
  uptime      : { type: Number, default: 0 },
  downtime    : { type: Number, default: 0 },
  qos         : {}
});
Check.plugin(require('mongoose-lifecycle'));

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
    function(cb) { CheckMonthlyStat.remove({ check: self._id }, cb); },
    function(cb) { CheckYearlyStat.remove({ check: self._id }, cb); }
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
  if (!this.isPaused) {
    // restarted
    this.isUp = undefined;
  }
  this.lastChanged = new Date();
}

Check.methods.setLastTest = function(status, time, error) {
  var now = time ? new Date(time) : new Date();
  if (!this.firstTested) {
    this.firstTested = now;
  }
  this.lastTested = now;
  if (this.isUp != status) {
    var event = new CheckEvent({
      timestamp: now,
      check: this,
      tags: this.tags,
      message: status ? 'up' : 'down',
      details: error
    });
    if (status && this.lastChanged && this.isUp != undefined) {
      // Check comes back up
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
  .sort({ timestamp: -1 })
  .exec(function(err, latestPing) {
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
      .where('timestamp').lt(latestPing.timestamp)
      .sort({ timestamp: -1 })
      .exec(function(err, latestDownPing) {
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
          .sort({ timestamp: 1 })
          .exec(function(err, firstPing) {
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
      .where('timestamp').lt( latestPing.timestamp)
      .sort({ timestamp: -1 })
      .exec(function(err, latestUpPing) {
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
          .sort({ timestamp: 1 })
          .exec(function(err, firstPing) {
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
  'hour':  { model: 'Ping', beginMethod: 'resetHour', endMethod: 'completeHour' },
  'day':   { model: 'CheckHourlyStat', beginMethod: 'resetDay', endMethod: 'completeDay', duration: 60 * 60 * 1000 },
  'month': { model: 'CheckDailyStat', beginMethod: 'resetMonth', endMethod: 'completeMonth', duration: 24 * 60 * 60 * 1000 },
  'year':  { model: 'CheckMonthlyStat', beginMethod: 'resetYear', endMethod: 'completeYear' }
};

Check.methods.getStatsForPeriod = function(period, begin, end, callback) {
  var periodPrefs = statProvider[period];
  var stats = [];
  var query = { check: this, timestamp: { $gte: begin, $lte: end } };
  var stream = this.db.model(periodPrefs['model']).find(query).sort({ timestamp: -1 }).stream();
  stream.on('error', function(err) {
    callback(err);
  }).on('data', function(stat) {
    if (typeof stat.isUp != 'undefined') {
      // stat is a Ping
      stats.push(stat);
    } else {
      // stat is an aggregation
      stats.push({
        timestamp: Date.parse(stat.timestamp),
        availability: (stat.availability * 100).toFixed(3),
        responsiveness: (stat.responsiveness * 100).toFixed(3),
        downtime: parseInt(stat.downtime / 1000),
        responseTime: parseInt(stat.responseTime),
        outages: stat.outages || [],
        end: stat.end ? stat.end.valueOf() : (Date.parse(stat.timestamp) + periodPrefs['duration'])
      });
    };
  }).on('close', function() {
    callback(null, stats);
  });
}

var singleStatsProvider = {
  'hour':  'CheckHourlyStat',
  'day':   'CheckDailyStat',
  'month': 'CheckMonthlyStat',
  'year':  'CheckYearlyStat'
};

Check.methods.getSingleStatForPeriod = function(period, date, callback) {
  var model = singleStatsProvider[period];
  var begin = moment(date).clone().startOf(period).toDate();
  var end   = moment(date).clone().endOf(period).toDate();
  var query = { check: this, timestamp: { $gte: begin, $lte: end } };
  this.db.model(model).findOne(query, function(err, stat) {
    if (err || !stat) return callback(err);
    return callback(null, {
      timestamp: Date.parse(stat.timestamp),
      availability: (stat.availability * 100).toFixed(3),
      responsiveness: (stat.responsiveness * 100).toFixed(3),
      downtime: parseInt(stat.downtime / 1000),
      responseTime: parseInt(stat.responseTime),
      outages: stat.outages || [],
      begin: begin.valueOf(),
      end: end.valueOf()
    })
  });
}

Check.statics.getAllTags = function(callback) {
  this.aggregate(
    { $unwind: "$tags" },
    { $group: {
    _id: null,
    tags: { $addToSet: "$tags" }
  } }, function(err, res) {
    if (err || !res.length) return callback(err, []);
    return callback(null, res[0].tags);
  });
}

Check.statics.findForTag = function(tag, callback) {
  return this.find().where('tags').equals(tag).exec(callback);
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
 * A check needs to be polled if it was last polled since a longer time than its own interval.
 *
 * @param {Function} Callback function to be called with each Check
 * @api   public
 */
Check.statics.callForChecksNeedingPoll = function(callback) {
  var stream = this.needingPoll().stream();
  stream.on('data', function(check) {
    callback(check);
  });
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