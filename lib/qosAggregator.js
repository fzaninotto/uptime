var async = require('async');
var Ping = require('../models/ping');
var TimeCalculator = require('./timeCalculator');
var UptimeCalculator = require('./uptimeCalculator');

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
  var start = TimeCalculator.resetHour(now);
  var end   = TimeCalculator.completeHour(now);
  async.series([
    async.apply(this.updateHourlyCheckQos.bind(this), start, end),
    async.apply(this.updateHourlyTagQos.bind(this), start, end)
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
    async.forEach(stats, function(stat, next) {
      CheckHourlyStat.update(
        { check: stat.check, timestamp: stat.timestamp },
        { $set: stat },
        { upsert: true }, 
        next
      );
    }, callback);
  });
}

QosAggregator.prototype.updateHourlyTagQos = function(start, end, callback) {
  var TagHourlyStat   = require('../models/tagHourlyStat');
  this.unwindCheckHourlyStatForTags(start, end, function(err, stats) {
    if (err) return callback(err);
    async.forEach(stats, function(stat, next) {
      TagHourlyStat.update(
        { name: stat.name, timestamp: start },
        { $set: stat },
        { upsert: true },
        next
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
  var start = new Date(Date.now() - (24 * 60 * 60 * 1000));
  var end   = new Date();
  async.series([
    async.apply(this.updateLast24HoursCheckQos.bind(this), start, end),
    async.apply(this.updateLast24HoursTagQos.bind(this), start, end),
  ], callback);
}

QosAggregator.prototype.updateLast24HoursCheckQos = function(start, end, callback) {
  var Check = require('../models/check');
  this.aggregatePingsIntoStatsGroupedByCheck(start, end, function(err, stats) {
    async.forEach(stats, function(stat, next) {
      Check.findById(stat.check, function (err2, check) {
        if (err2 || !check) return cb(err2);
        check.qos = stat;
        check.markModified('qos');
        check.save(next);
      });
    }, callback);
  });
}

QosAggregator.prototype.updateLast24HoursTagQos = function(start, end, callback) {
  var Tag   = require('../models/tag');
  this.unwindCheckHourlyStatForTags(start, end, function(err, stats) {
    if (err) return callback(err);
    async.forEach(stats, function(stat, next) {
      Tag.update(
        { name: stat.name },
        { $set: { lastUpdated: end, count: stat.count, availability: stat.availability, responsiveness: stat.responsiveness, responseTime: stat.responseTime, downtime: stat.downtime, outages: stat.outages } },
        { upsert: true }, 
        next
      );
    }, callback);
  });
}

/**
 * Aggregate Qos data of Pings from all checks between two boundaries
 *
 * @param {Date} Date object of a the beginning of the search period
 * @param {Date} Date object of a the end of the search period
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.aggregatePingsIntoStatsGroupedByCheck = function(start, end, callback) {
  async.waterfall([
    function (next) { next(null, start, end) }, // pass the parameters to the next function
    this.aggregatePingsByCheck,
    this.createStatsFromPingAggregation.bind(this)
  ], callback);
}


QosAggregator.prototype.aggregatePingsByCheck = function(start, end, callback) {
  Ping.aggregate(
    { $match: { 
      timestamp: { $gte: start, $lte: end }
    } },
    { $project: {
      check: 1,
      responsive: { $cond: [ { $and: ["$isResponsive"] }, 1, 0] },
      time: 1,
      tags: 1,
    } },
    { $group: {
      _id: "$check",
      count: { $sum: 1 },
      responsiveness: { $avg: "$responsive" },
      responseTime: { $avg: "$time" },
      tags: { $first: "$tags" },
      start: { $first: start.valueOf() }, // dunno any other way to set a constant
      end: { $first: end.valueOf() }
    } },
    callback
  );
}

QosAggregator.prototype.createStatsFromPingAggregation = function(documents, callback) {
  var self = this;
  var aggregatedStats = [];
  async.forEach(documents, function(document, next) {
    self.createSingleStatFromPingAggregationDocument(document, function(err, stat) {
      if (err) return cb(err);
      aggregatedStats.push(stat);
      next();
    });
  }, function(err) {
    callback(err, aggregatedStats);
  });
}

QosAggregator.prototype.createSingleStatFromPingAggregationDocument = function(document, callback) {
  var duration = document.end - document.start;
  var stat = {
    check: document._id,
    timestamp: document.start,
    count: document.count,
    responsiveness: document.responsiveness,
    responseTime: document.responseTime,
    tags: document.tags
  };
  var calculator = new UptimeCalculator(document._id);
  calculator.getOutages(document.start, document.end, function(err, outages, downtime) {
    if (err) return callback(err);
    if (outages.length) {
      stat.outages = outages;
    }
    stat.downtime = downtime;
    stat.availability = (duration - downtime) / duration;
    callback(null, stat);
  });
}

QosAggregator.prototype.unwindCheckHourlyStatForTags = function(start, end, callback) {
  async.waterfall([
    function (next) { next(null, start, end) }, // pass the parameters to the next function
    this.aggregateCheckStatsByTag,
    this.createStatFromCheckStatAggregation.bind(this)
  ], callback);
}

QosAggregator.prototype.aggregateCheckStatsByTag = function(start, end, callback) {
  var CheckHourlyStat = require('../models/checkHourlyStat');
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
      outages: { $push: "$outages" },
      start: { $first: start.valueOf() },
      end: { $first: end.valueOf() }
    } },
    callback
  );
}

QosAggregator.prototype.createStatFromCheckStatAggregation = function(documents, callback) {
  var UptimeCalculator = require('./uptimeCalculator');
  var aggregatedStats = [];
  async.forEach(documents, function(document, next) {
    var outages = UptimeCalculator.mergePeriods(document.outages);
    var downtime = UptimeCalculator.computeDowntime(outages);
    aggregatedStats.push({
      name: document._id,
      timestamp: document.start,
      count: document.count,
      availability: (document.end - document.start - downtime) / (document.end - document.start),
      responsiveness: document.responsiveness,
      responseTime: document.responseTime,
      downtime: downtime,
      outages: outages,
    });
    next();
  }, function(err) {
    return callback(err, aggregatedStats);
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
    async.apply(this.updatePeriodicalQos.bind(this), start, end, CheckHourlyStat, CheckDailyStat, "$check", true),
    async.apply(this.updatePeriodicalQos.bind(this), start, end, TagHourlyStat, TagDailyStat, "$name", false),
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
    async.apply(this.updatePeriodicalQos.bind(this), start, end, CheckDailyStat, CheckMonthlyStat, "$check", true),
    async.apply(this.updatePeriodicalQos.bind(this), start, end, TagDailyStat, TagMonthlyStat, "$name", false),
  ], callback);
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