var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var TimeCalculator = require('../lib/timeCalculator');
var QosAggregator = require('../lib/qosAggregator');
var async    = require('async');

var Ping = new Schema({
  timestamp    : { type: Date, default: Date.now },
  isUp         : Boolean,  // false if ping returned a non-OK status code or timed out
  isResponsive : Boolean,  // true if the ping time is less than the check max time 
  time         : Number,
  check        : { type: Schema.ObjectId, ref: 'Check' },
  tags         : [String],
  monitorName  : String,
  // for pings in error, more details need to be persisted
  downtime     : Number,   // time since last ping if the ping is down
  error        : String
});
Ping.index({ timestamp: -1 });
Ping.plugin(require('mongoose-lifecycle'));

Ping.methods.findCheck = function(callback) {
  return this.db.model('Check').findById(this.check, callback);
}

Ping.statics.createForCheck = function(status, timestamp, time, check, monitorName, error, callback) {
  timestamp = constructor == Date ? timestamp : new Date(parseInt(timestamp));
  console.dir(timestamp);
  ping = new this();
  ping.timestamp = timestamp;
  ping.isUp = status;
  if (status && check.maxTime) {
    ping.isResponsive = time < check.maxTime;
  } else {
    ping.isResponsive = false;
  }
  ping.time = time;
  ping.check = check;
  ping.tags = check.tags;
  ping.monitorName = monitorName;
  if (!status) {
    ping.downtime = check.interval || 60000;
    ping.error = error;
  };
  ping.save(function(err) {
    callback(err, ping);
    if (!err) {
      check.setLastTest(status, timestamp, error);
      check.save();
    };
  });
}

var mapCheckAndTags = function() {
  var qos = { count: 1, ups: this.isUp ? 1 : 0 , responsives: this.isResponsive ? 1 : 0, time: this.time, downtime: this.downtime ? this.downtime : 0 };
  emit(this.check, qos);
  if (!this.tags) return;
  for (index in this.tags) {
    emit(this.tags[index], qos);
  }
};

Ping.statics.updateHourlyQos = function(now, callback) {
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    callback = function(err) { if (err) console.dir(err); };
  }
  var start = TimeCalculator.resetHour(now);
  var end   = TimeCalculator.completeHour(now);
  var CheckHourlyStat = require('./checkHourlyStat');
  var TagHourlyStat   = require('./tagHourlyStat');
  QosAggregator.getQosForPeriod(this.collection, mapCheckAndTags, start, end, function(err, results) {
    if (err) return callback(err);
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      if (result._id.substr) {
        // the key is a string, so it's a tag
        TagHourlyStat.update({ name: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
      } else {
        // the key is a check
        CheckHourlyStat.update({ check: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
      }
    }, callback);
  });
}

Ping.statics.updateLastHourQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 6); // 6 minutes in the past, to accomodate script running every 5 minutes
  this.updateHourlyQos(now, callback);
}

Ping.statics.updateLast24HoursQos = function(callback) {
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    callback = function(err) { if (err) console.dir(err); };
  }
  var start = new Date(Date.now() - (24 * 60 * 60 * 1000));
  var end   = new Date();
  var Check = require('../models/check');
  var Tag   = require('../models/tag');
  QosAggregator.getQosForPeriod(this.collection, mapCheckAndTags, start, end, function(err, results) {
    if (err) return callback(err);
    async.forEach(results, function(result, cb) {
      if (result._id.substr) {
        // the key is a string, so it's a tag
        var stat = result.value;
        Tag.update({ name: result._id }, { $set: { lastUpdated: end, count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
      } else {
        // the key is a check
        Check.findById(result._id, function (err, check) {
          if (err || !check) return cb(err);
          check.qos = result.value;
          check.markModified('qos');
          check.save(cb);
        });
      }
    }, callback);
  });
}

Ping.statics.cleanup = function(maxAge, callback) {
  oldestDateToKeep = new Date(Date.now() - (maxAge ||  3 * 31 * 24 * 60 * 60 * 1000));
  this.find({ timestamp: { $lt: new Date(oldestDateToKeep) } }).remove(callback);
}

module.exports = mongoose.model('Ping', Ping);
