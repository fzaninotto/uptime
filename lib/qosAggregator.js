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

QosAggregator.prototype.updateHourlyQos = function(now, callback) {
  var self = this;
  var start = TimeCalculator.resetHour(now);
  var end   = TimeCalculator.completeHour(now);
  async.series([
    function(cb) { self.updateHourlyCheckQos(start, end, cb); },
    function(cb) { self.updateHourlyTagQos(start, end, cb); },
  ], callback);
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
QosAggregator.prototype.updateHourlyCheckQos = function(start, end, callback) {
  var CheckHourlyStat  = require('../models/checkHourlyStat');
  this.aggregatePingsIntoStatsGroupedByCheck(start, end, function(err, stats) {
    async.forEach(stats, function(stat, cb) {
      CheckHourlyStat.update(
        { check: stat.check, timestamp: stat.timestamp },
        { $set: stat },
        { upsert: true }, 
        cb
      );
    }, callback);
  });
}

QosAggregator.prototype.updateHourlyTagQos = function(start, end, callback) {
  var TagHourlyStat   = require('../models/tagHourlyStat');
  this.unwindCheckHourlyStatForTags(start, end, function(err, stats) {
    if (err) return callback(err);
    async.forEach(stats, function(stat, cb) {
      TagHourlyStat.update(
        { name: stat.name, timestamp: start },
        { $set: stat },
        { upsert: true },
        cb
      );
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
  var self = this;
  var start = new Date(Date.now() - (24 * 60 * 60 * 1000));
  var end   = new Date();
  async.series([
    function(cb) { self.updateLast24HoursCheckQos(start, end, cb); },
    function(cb) { self.updateLast24HoursTagQos(start, end, cb); },
  ], callback);
}

QosAggregator.prototype.updateLast24HoursCheckQos = function(start, end, callback) {
  var Check = require('../models/check');
  this.aggregatePingsIntoStatsGroupedByCheck(start, end, function(err, stats) {
    async.forEach(stats, function(stat, cb) {
      Check.findById(stat.check, function (err2, check) {
        if (err2 || !check) return cb(err2);
        check.qos = stat;
        check.markModified('qos');
        check.save(cb);
      });
    }, callback);
  });
}

QosAggregator.prototype.updateLast24HoursTagQos = function(start, end, callback) {
  var Tag   = require('../models/tag');
  this.unwindCheckHourlyStatForTags(start, end, function(err, stats) {
    if (err) return callback(err);
    async.forEach(stats, function(stat, cb) {
      Tag.update({ name: stat.name }, { $set: { lastUpdated: end, count: stat.count, availability: stat.availability, responsiveness: stat.responsiveness, responseTime: stat.responseTime, downtime: stat.downtime, outages: stat.outages } }, { upsert: true }, cb);
    }, callback);
  });
}

/**
 * Aggregate Qos data of Pings from all checks around between two boundaries into CheckHourlyStat documents
 *
 * @param {Date} Date object of a the beginning of the search period
 * @param {Date} Date object of a the end of the search period
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.aggregatePingsIntoStatsGroupedByCheck = function(start, end, callback) {
  callback = this.getCallback(callback);
  var hour  = end - start;
  var Ping  = require('../models/ping');
  var CheckHourlyStat  = require('../models/checkHourlyStat');
  var UptimeCalculator = require('./uptimeCalculator');
  var aggregatedStats = [];
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
        calculator.getOutages(start, end, function(err2, periods, downtime) {
          if (err2) return cb(err2);
          aggregatedStats.push({
            check: stat._id,
            timestamp: start,
            count: stat.count,
            availability: (hour - downtime) / hour,
            responsiveness: stat.responsiveness,
            responseTime: stat.responseTime,
            downtime: downtime,
            outages: periods,
            tags: stat.tags
          });
          cb();
        });
      }, function(err) {
        return callback(err, aggregatedStats);
      });
    }
  );
}

QosAggregator.prototype.unwindCheckHourlyStatForTags = function(start, end, callback) {
  callback = this.getCallback(callback);
  var CheckHourlyStat = require('../models/checkHourlyStat');
  var TagHourlyStat   = require('../models/tagHourlyStat');
  var UptimeCalculator = require('./uptimeCalculator');
  var aggregatedStats = [];
  CheckHourlyStat.aggregate(
    { $match: { 
      timestamp: { $gte: start, $lte: end }
    } },
    { $unwind: "$tags" },
    { $group: {
      _id: "$tags",
      count: { $sum: "$count" },
      responsiveness: { $avg: "$responsiveness" },
      responseTime: { $avg: "$responseTime" },
      outages: { $push: "$outages" }
    } },
    function(err, stats) {
      if (err) return callback(err);
      async.forEach(stats, function(stat, cb) {
        var outages = UptimeCalculator.mergePeriods(stat.outages);
        var downtime = UptimeCalculator.computeDowntime(outages);
        aggregatedStats.push({
          name: stat._id,
          timestamp: start,
          count: stat.count,
          availability: (end - start - downtime) / (end - start),
          responsiveness: stat.responsiveness,
          responseTime: stat.responseTime,
          downtime: downtime,
          outages: outages,
        });
        cb();
      }, function(err2) {
        return callback(err2, aggregatedStats);
      });
    }
  );
}

QosAggregator.prototype.updatePeriodicalQos = function(start, end, fromStat, toStat, groupIdentifier, includeTags, callback) {
  callback = this.getCallback(callback);
  var key = groupIdentifier.substr(1);
  var query;
  var duration = end - start;
  var UptimeCalculator = require('./uptimeCalculator');
  var pipeline = [
    { $match: {
      timestamp: { $gte: start, $lte: end }
    } },
    { $sort: {
      timestamp: 1 
    } },
    { $group: {
      _id: groupIdentifier,
      count: { $sum: "$count" },
      responsiveness: { $avg: "$responsiveness" },
      responseTime: { $avg: "$responseTime" },
      downtime: { $sum: "$downtime" },
      outages: { $push: "$outages" }
    } }
  ];
  if (includeTags) {
    pipeline[2].$group.tags = { $first: "$tags" };
  }
  fromStat.aggregate(pipeline, function(err, stats) {
    if (err) return callback(err);
    async.forEach(stats, function(stat, cb) {
      var toStatDocument = {
        count: stat.count,
        availability: (duration - stat.downtime) / duration,
        responsiveness: stat.responsiveness,
        responseTime: stat.responseTime,
        downtime: stat.downtime,
        outages: UptimeCalculator.mergeConsecutivePeriods(stat.outages)
      };
      if (includeTags) {
        toStatDocument.tags = stat.tags;
      }
      query = { timestamp: start };
      query[key] = stat._id;
      toStat.update(
        query,
        { $set: toStatDocument },
        { upsert: true },
        cb
      );
    }, callback);
  });
}

/**
 * Aggregate hourly Qos data from all checks and tags around a timestamp
 * into daily stat documents.
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
  var CheckHourlyStat = require('../models/checkHourlyStat');
  var CheckDailyStat  = require('../models/checkDailyStat');
  var TagHourlyStat   = require('../models/tagHourlyStat');
  var TagDailyStat    = require('../models/tagDailyStat');
  async.series([
    function(cb) { QosAggregator.prototype.updatePeriodicalQos(start, end, CheckHourlyStat, CheckDailyStat, "$check", true, cb); },
    function(cb) { QosAggregator.prototype.updatePeriodicalQos(start, end, TagHourlyStat, TagDailyStat, "$name", false, cb); },
  ], callback);
}

/**
 * Aggregate daily Qos data from all checks and tags around a timestamp
 * into monthly stat documents.
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
  var start = TimeCalculator.resetDay(now);
  var end   = TimeCalculator.completeDay(now);
  var CheckDailyStat   = require('../models/checkDailyStat');
  var CheckMonthlyStat = require('../models/checkMonthlyStat');
  var TagDailyStat   = require('../models/tagDailyStat');
  var TagMonthlyStat = require('../models/tagMonthlyStat');
  async.series([
    function(cb) { QosAggregator.prototype.updatePeriodicalQos(start, end, CheckDailyStat, CheckMonthlyStat, "$check", true, cb); },
    function(cb) { QosAggregator.prototype.updatePeriodicalQos(start, end, TagDailyStat, TagMonthlyStat, "$name", false, cb); },
  ], callback);
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