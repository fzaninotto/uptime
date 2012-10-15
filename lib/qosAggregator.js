var async    = require('async');
var TimeCalculator = require('../lib/timeCalculator');

var QosAggregator = function() {
};

QosAggregator.prototype.getCallback = function(callback){
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    return function(err) { if (err) console.dir(err); };
  }
  return callback;
}

/**
 * Aggregate Qos data of Pings from all checks around a timestamp into CheckHourlyStat documents
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
  var hour  = end - start;
  var Ping  = require('../models/ping');
  var CheckHourlyStat  = require('../models/checkHourlyStat');
  var UptimeCalculator = require('./uptimeCalculator');
  Ping.aggregate(
    { $match: { 
      timestamp: { $gte: start, $lte: end }
    } },
    { $project: {
      check: 1,
      responsive: { $cond: [ { $and: ["$isResponsive"] }, 1, 0] },
      time: 1,
      tags: 1
    } },
    { $group: {
      _id: "$check",
      count: { $sum: 1 },
      responsiveness: { $avg: "$responsive" },
      responseTime: { $avg: "$time" },
      tags: { $first: "$tags"}
    } },
    function(err, stats) {
      if (err) return callback(err);
      async.forEach(stats, function(stat, cb) {
        var calculator = new UptimeCalculator(stat._id);
        calculator.getUptimePeriods(start, end, function(err2, periods, totalUptime) {
          if (err2) return cb(err2);
          var hourlyStat = { 
            count: stat.count,
            availability: totalUptime / hour,
            responsiveness: stat.responsiveness,
            responseTime: stat.responseTime,
            downtime: hour - totalUptime,
            periods: periods,
            tags: stat.tags
          };
          CheckHourlyStat.update(
            { check: stat._id, timestamp: start },
            { $set: hourlyStat },
            { upsert: true }, 
            cb
          );
        });
      }, callback);
    }
  );
}

QosAggregator.prototype.updateHourlyTagQos = function(now, callback) {
  callback = this.getCallback(callback);
  var start = TimeCalculator.resetHour(now);
  var end   = TimeCalculator.completeHour(now);
  var CheckHourlyStat = require('../models/checkHourlyStat');
  var TagHourlyStat   = require('../models/tagHourlyStat');
  var UptimeCalculator = require('./uptimeCalculator');
  CheckHourlyStat.aggregate(
    { $unwind: "$tags" },
    { $group: {
      _id: "$tags",
      count: { $sum: "$count" },
      responsiveness: { $avg: "$responsiveness" },
      responseTime: { $avg: "$responseTime" },
      periods: { $puch: "$periods" }
    } },
    function(err, stats) {
      if (err) return callback(err);
      async.forEach(stats, function(stat, cb) {
        var uptimePeriods = UptimeCalculator.intersectPeriods(stat.periods);
        var downtime = UptimeCalculator.computeDowntime(start, end, uptimePeriods);
        var hourlyStat = {
          count: stat.count,
          availability: (end - start - downtime) / (end - start),
          responsiveness: tag.responsiveness,
          responseTime: tag.responseTime,
          downtime: downtime,
          periods: uptimePeriods,
        };
        TagHourlyStat.update(
          { name: stat._id, timestamp: start },
          { $set: hourlyStat },
          { upsert: true }, 
          cb
        );
      }, callback);
    }
  );
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
  return callback();
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
 * Aggregate Qos data of CheckHourlyStatStat from all checks and tags around a timestamp
 * into CheckDailyStat documents.
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
  callback = this.getCallback(callback);
  var start = TimeCalculator.resetDay(now);
  var end   = TimeCalculator.completeDay(now);
  var day   = end - start;
  var CheckHourlyStat = require('../models/checkHourlyStat');
  var CheckDailyStat  = require('../models/checkDailyStat');
  var UptimeCalculator = require('./uptimeCalculator');
  CheckHourlyStat.aggregate(
    { $match: { 
      timestamp: { $gte: start, $lte: end }
    } },
    { $sort: { 
      timestamp: 1 
    } },
    { $group: {
      _id: "$check",
      count: { $sum: "$count" },
      responsiveness: { $avg: "$responsiveness" },
      responseTime: { $avg: "$responseTime" },
      downtime: { $sum: "$downtime" },
      periods: { $push: "$periods" },
      tags: { $first: "$tags" }
    } },
    function(err, stats) {
      if (err) return callback(err);
      async.forEach(stats, function(stat, cb) {
        var dailyStat = { 
          count: stat.count,
          availability: (day - stat.downtime) / day,
          responsiveness: stat.responsiveness,
          responseTime: stat.responseTime,
          downtime: stat.downtime,
          periods: UptimeCalculator.mergeConsecutivePeriods(stat.periods),
          tags: stat.tags
        };
        CheckDailyStat.update(
          { check: stat._id, timestamp: start },
          { $set: dailyStat },
          { upsert: true }, 
          cb
        );
      }, callback);
    }
  );
}

/**
 * Aggregate Qos data of CheckDailyStat from all checks and tags around a timestamp
 * into CheckMonthlyStat documents.
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
  callback = this.getCallback(callback);
  var start = TimeCalculator.resetMonth(now);
  var end   = TimeCalculator.completeMonth(now);
  var month = end - start;
  var CheckDailyStat   = require('../models/checkDailyStat');
  var CheckMonthlyStat = require('../models/checkMonthlyStat');
  var UptimeCalculator = require('./uptimeCalculator');
  CheckDailyStat.aggregate(
    { $match: { 
      timestamp: { $gte: start, $lte: end }
    } },
    { $group: {
      _id: "$check",
      count: { $sum: "$count" },
      responsiveness: { $avg: "$responsiveness" },
      responseTime: { $avg: "$responseTime" },
      downtime: { $sum: "$downtime" },
      periods: { $push: "$periods" },
      tags: { $first: "$tags"}
    } },
    function(err, stats) {
      if (err) return callback(err);
      async.forEach(stats, function(stat, cb) {
        var monthlyStat = { 
          count: stat.count,
          availability: (month - stat.downtime) / month,
          responsiveness: stat.responsiveness,
          responseTime: stat.responseTime,
          downtime: stat.downtime,
          periods: UptimeCalculator.mergeConsecutivePeriods(stat.periods),
          tags: stat.tags
        };
        CheckMonthlyStat.update(
          { check: stat._id, timestamp: start },
          { $set: monthlyStat },
          { upsert: true }, 
          cb
        );
      }, callback);
    }
  );}

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