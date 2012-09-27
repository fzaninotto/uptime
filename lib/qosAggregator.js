var async    = require('async');
var TimeCalculator = require('../lib/timeCalculator');

var QosAggregator = function() {
};

/* Map qos for Ping documents */
QosAggregator.prototype.mapCheckAndTags = function() {
  var qos = { count: 1, ups: this.isUp ? 1 : 0 , responsives: this.isResponsive ? 1 : 0, time: this.time, downtime: this.downtime ? this.downtime : 0 };
  emit(this.check, qos);
  if (!this.tags) return;
  for (index in this.tags) {
    emit(this.tags[index], qos);
  }
};

/* Map qos for CheckHourlyStat documents */
QosAggregator.prototype.mapCheck = function() {
  var qos = { count: this.count, ups: this.ups , responsives: this.responsives, time: this.time, downtime: this.downtime };
  emit(this.check, qos);
};

/* Map qos for TagHourlyStat documents */
QosAggregator.prototype.mapTag = function() {
  var qos = { count: this.count, ups: this.ups , responsives: this.responsives, time: this.time, downtime: this.downtime };
  emit(this.name, qos);
};


QosAggregator.prototype.reduce = function(key, values) {
  var result = { count: 0, ups: 0, responsives: 0, time: 0, downtime: 0 };
  values.forEach(function(value) {
    result.count       += value.count;
    result.ups         += value.ups;
    result.responsives += value.responsives;
    result.time        += value.time;
    result.downtime    += value.downtime;
  });
  return result;
};

QosAggregator.prototype.getQosForPeriod = function(collection, mapFunction, start, end, callback) {
  collection.mapReduce(
    mapFunction.toString(),
    this.reduce.toString(),
    { query: { timestamp: { $gte: start, $lte: end } }, out: { inline: 1 } },
    callback
  );
};

QosAggregator.prototype.getCallback = function(callback){
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    return function(err) { if (err) console.dir(err); };
  }
  return callback;
}

/**
 * Aggregate Qos data of Pings from all checks around a timestamp into CheckHourlyStat and TagHourlyStat documents
 *
 * The method finds the boundaries of the hour
 * by resetting/completing the hour of the timestamp.
 *
 * @param {Int|Date} timestamp or Date object of a moment inside the chosen hour
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateHourlyQos = function(now, callback) {
  callback = this.getCallback(callback);
  var start = TimeCalculator.resetHour(now);
  var end   = TimeCalculator.completeHour(now);
  var Ping  = require('../models/ping');
  var CheckHourlyStat  = require('../models/checkHourlyStat');
  var TagHourlyStat    = require('../models/tagHourlyStat');
  var UptimeCalculator = require('./uptimeCalculator');
  this.getQosForPeriod(Ping.collection, this.mapCheckAndTags, start, end, function(err, results) {
    if (err) return callback(err);
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      if (result._id.substr) {
        // the key is a string, so it's a tag
        TagHourlyStat.update({ name: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
      } else {
        // the key is a check
        var calculator = new UptimeCalculator(result._id);
        calculator.getUptimePeriods(start, end, function(err2, periods) {
          if (err2) return cb(err2);
          CheckHourlyStat.update({ check: result._id, timestamp: start }, { $set: { periods: periods, count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
        });
      }
    }, callback);
  });
}

/**
 * Aggregate Qos data of Pings from the last 24h into the qos property of checks and tags
 *
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateLast24HoursQos = function(callback) {
  callback = this.getCallback(callback);
  var start = new Date(Date.now() - (24 * 60 * 60 * 1000));
  var end   = new Date();
  var Ping  = require('../models/ping');
  var Check = require('../models/check');
  var Tag   = require('../models/tag');
  this.getQosForPeriod(Ping.collection, this.mapCheckAndTags, start, end, function(err, results) {
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

/**
 * Aggregate Qos data of CheckHourlyStatStat and TagHourlyStat from all checks and tags around a timestamp
 * into CheckDailyStat znd TagDailystat documents.
 *
* The method finds the boundaries of the day
 * by resetting/completing the day of the timestamp.
 *
 * @param {Int|Date} timestamp or Date object of a moment inside the chosen day
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateDailyQos = function(now, callback) {
  var start = TimeCalculator.resetDay(now);
  var end   = TimeCalculator.completeDay(now);
  var self = this;
  async.parallel([
    function(cb) { self.updateDailyQosForChecks(start, end, cb); },
    function(cb) { self.updateDailyQosForTags(start, end, cb); },
  ], callback);
}

/**
 * Aggregate Qos data of CheckHourlyStat from all checks around a timestamp into CheckDailyStat documents
 *
 * @param {Date} start of the the chosen day
 * @param {Date} end of the the chosen day
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateDailyQosForChecks = function(start, end, callback) {
  callback = this.getCallback(callback);
  var CheckHourlyStat = require('../models/checkHourlyStat');
  var CheckDailyStat  = require('../models/checkDailyStat');
  this.getQosForPeriod(CheckHourlyStat.collection, this.mapCheck, start, end, function(err, results) {
    if (err) return;
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      CheckDailyStat.update({ check: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
    }, callback);
  });
}

/**
 * Aggregate Qos data of TagHourlyStat from all tags around a timestamp into TagDailyStat documents
 *
 * @param {Date} start of the the chosen day
 * @param {Date} end of the the chosen day
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateDailyQosForTags = function(start, end, callback) {
  callback = this.getCallback(callback);
  var TagHourlyStat = require('../models/tagHourlyStat');
  var TagDailyStat  = require('../models/tagDailyStat');
  this.getQosForPeriod(TagHourlyStat.collection, this.mapTag, start, end, function(err, results) {
    if (err) return callback(err);
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      TagDailyStat.update({ name: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
    }, callback);
  });
}

/**
 * Aggregate Qos data of CheckDailyStat and TagDailyStat from all checks and tags around a timestamp
 * into CheckMonthlyStat and TagMonthlystat documents.
 *
 * The method finds the boundaries of the month
 * by resetting/completing the month of the timestamp.
 *
 * @param {Int|Date} timestamp or Date object of a moment inside the chosen month
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateMonthlyQos = function(now, callback) {
  var start = TimeCalculator.resetMonth(now);
  var end   = TimeCalculator.completeMonth(now);
  var self = this;
  async.parallel([
    function(cb) { self.updateMonthlyQosForChecks(start, end, cb); },
    function(cb) { self.updateMonthlyQosForTags(start, end, cb); },
  ], callback);
}

/**
 * Aggregate Qos data of CheckDailyStat from all checks around a timestamp into CheckMonthlyStat documents
 *
 * @param {Date} start of the the chosen month
 * @param {Date} end of the the chosen month
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateMonthlyQosForChecks = function(start, end, callback) {
  callback = this.getCallback(callback);
  var CheckDailyStat   = require('../models/checkDailyStat');
  var CheckMonthlyStat = require('../models/checkMonthlyStat');
  this.getQosForPeriod(CheckDailyStat.collection, this.mapCheck, start, end, function(err, results) {
    if (err) return;
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      CheckMonthlyStat.update({ check: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
    }, callback);
  });
}

/**
 * Aggregate Qos data of TagDailyStat from all tags around a timestamp into TagMonthlyStat documents
 *
 * @param {Date} start of the the chosen month
 * @param {Date} end of the the chosen month
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateMonthlyQosForTags = function(start, end, callback) {
  callback = this.getCallback(callback);
  var TagDailyStat   = require('../models/tagDailyStat');
  var TagMonthlyStat = require('../models/tagMonthlyStat');
  this.getQosForPeriod(TagDailyStat.collection, this.mapTag, start, end, function(err, results) {
    if (err) return callback(err);
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      TagMonthlyStat.update({ name: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
    }, callback);
  });
}

/**
 * Aggregate Qos data of Pings from all checks from the last hour
 * into CheckHourlyStat and TagHourlyStat documents.
 *
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateLastHourQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 6); // 6 minutes in the past, to accomodate script running every 5 minutes
  this.updateHourlyQos(now, callback);
}

/**
 * Aggregate Qos data of CheckHourlyStat from all checks from the last day
 * into CheckDailyStat documents.
 *
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateLastDayQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accomodate script running every hour
  this.updateDailyQos(now, callback);
}

/**
 * Aggregate Qos data of CheckDailyStat from all checks from the last month
 * into CheckMonthlyStat documents.
 *
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateLastMonthQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accomodate script running every hour
  this.updateMonthlyQos(now, callback);
}

module.exports = new QosAggregator();