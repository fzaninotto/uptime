var async  = require('async');
var moment = require('moment');
var Ping   = require('../models/ping');
var IntervalBuilder = require('./intervalBuilder');

var QosAggregator = function() {
};

QosAggregator.prototype.getCallback = function(callback){
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    return function(err) { if (err) console.dir(err); };
  }
  return callback;
};

QosAggregator.prototype.updateHourlyQos = function(now, callback) {
  var start = moment(now).clone().startOf('hour').toDate();
  var end   = moment(now).clone().endOf('hour').toDate();
  async.parallel([
    async.apply(this.updateHourlyCheckQos.bind(this), start, end),
    async.apply(this.updateHourlyTagQos.bind(this), start, end)
  ], callback);
};

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
};

QosAggregator.prototype.updateHourlyTagQos = function(start, end, callback) {
  var TagHourlyStat   = require('../models/tagHourlyStat');
  this.aggregatePingsIntoStatsGroupedByTag(start, end, function(err, stats) {
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
};

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
  async.parallel([
    async.apply(this.updateLast24HoursCheckQos.bind(this), start, end),
    async.apply(this.updateLast24HoursTagQos.bind(this), start, end),
  ], callback);
};

QosAggregator.prototype.updateLast24HoursCheckQos = function(start, end, callback) {
  var Check = require('../models/check');
  this.aggregatePingsIntoStatsGroupedByCheck(start, end, function(err, stats) {
    if (err) return callback(err);
    async.forEach(stats, function(stat, next) {
      Check.findById(stat.check, function (err2, check) {
        if (err2 || !check) return next(err2);
        check.qos = stat;
        check.markModified('qos');
        check.save(next);
      });
    }, callback);
  });
};

QosAggregator.prototype.updateLast24HoursTagQos = function(start, end, callback) {
  var Tag   = require('../models/tag');
  this.aggregatePingsIntoStatsGroupedByTag(start, end, function(err, stats) {
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
};

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
    this.getCheckStats.bind(this)
  ], callback);
};


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
      start: { $first: start.valueOf() }, // dunno any other way to set a constant
      end: { $first: end.valueOf() }
    } },
    callback
  );
};

QosAggregator.prototype.getCheckStats = function(documents, callback) {
  var self = this;
  var aggregatedStats = [];
  async.forEach(documents, function(document, next) {
    self.createCheckStatFromPingAggregationDocument(document, function(err, stat) {
      if (err) return next(err);
      aggregatedStats.push(stat);
      next();
    });
  }, function(err) {
    callback(err, aggregatedStats);
  });
};

QosAggregator.prototype.createCheckStatFromPingAggregationDocument = function(document, callback) {
  var stat = {
    check: document._id,
    timestamp: document.start,
    count: document.count,
    responsiveness: document.responsiveness,
    responseTime: document.responseTime
  };
  var intervalBuilder = new IntervalBuilder();
  intervalBuilder.addTarget(document._id);
  intervalBuilder.build(document.start, document.end, function(err, outages, downtime, testedTime) {
    if (err) return callback(err);
    if (outages.length) {
      stat.outages = outages;
    }
    stat.downtime = downtime;
    stat.availability = testedTime != 0 ? (testedTime - downtime) / testedTime : 0;
    callback(null, stat);
  });
};

/**
 * Aggregate Qos data of Pings from all tags between two boundaries
 *
 * @param {Date} Date object of a the beginning of the search period
 * @param {Date} Date object of a the end of the search period
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.aggregatePingsIntoStatsGroupedByTag = function(start, end, callback) {
  async.waterfall([
    function (next) { next(null, start, end) }, // pass the parameters to the next function
    this.aggregatePingsByTag,
    this.getTagStats.bind(this)
  ], callback);
};

QosAggregator.prototype.aggregatePingsByTag = function(start, end, callback) {
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
    { $unwind: "$tags" },
    { $group: {
      _id: "$tags",
      count: { $sum: 1 },
      responsiveness: { $avg: "$responsive" },
      responseTime: { $avg: "$time" },
      start: { $first: start.valueOf() }, // dunno any other way to set a constant
      end: { $first: end.valueOf() }
    } },
    callback
  );
};

QosAggregator.prototype.getTagStats = function(documents, callback) {
  var self = this;
  var aggregatedStats = [];
  async.forEach(documents, function(document, next) {
    self.createTagStatFromPingAggregationDocument(document, function(err, stat) {
      if (err) return next(err);
      aggregatedStats.push(stat);
      next();
    });
  }, function(err) {
    callback(err, aggregatedStats);
  });
};

QosAggregator.prototype.createTagStatFromPingAggregationDocument = function(document, callback) {
  var Check = require('../models/check');
  var duration = document.end - document.start;
  var stat = {
    name: document._id,
    timestamp: document.start,
    count: document.count,
    responsiveness: document.responsiveness,
    responseTime: document.responseTime
  };
  var intervalBuilder = new IntervalBuilder();
  Check.findForTag(document._id, function(err, checks) {
    if (err) return callback(err);
    checks.forEach(function(check) {
      intervalBuilder.addTarget(check);
    });
    intervalBuilder.build(document.start, document.end, function(err2, outages, downtime, testedTime) {
      if (err2) return callback(err2);
      stat.outages = outages;
      stat.downtime = downtime;
      stat.availability = testedTime != 0 ? (testedTime - downtime) / testedTime : 0;
      callback(null, stat);
    });
  });
};

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
  var start = moment(now).clone().startOf('day').toDate();
  var end   = moment(now).clone().endOf('day').toDate();
  async.parallel([
    async.apply(this.updateDailyCheckQos.bind(this), start, end),
    async.apply(this.updateDailyTagQos.bind(this), start, end)
  ], callback);
};

QosAggregator.prototype.updateDailyCheckQos = function(start, end, callback) {
  async.waterfall([
    function (next) { next(null, start, end) }, // pass the parameters to the next function
    this.aggregateCheckHourlyStatsByCheck,
    this.createCheckDailyStats.bind(this)
  ], callback);
};

QosAggregator.prototype.aggregateCheckHourlyStatsByCheck = function(start, end, callback) {
  var CheckHourlyStat = require('../models/checkHourlyStat');
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
      start: { $first: start.valueOf() },
      end: { $first: end.valueOf() }
    } },
    callback
  );
};

QosAggregator.prototype.createCheckDailyStats = function(documents, callback) {
  var CheckDailyStat  = require('../models/checkDailyStat');
  var day = 24 * 60 * 60 * 1000;
  async.forEach(documents, function(document, next) {
    var stat = {
      count: document.count,
      responsiveness: document.responsiveness,
      responseTime: document.responseTime,
    };
    var intervalBuilder = new IntervalBuilder();
    intervalBuilder.addTarget(document._id);
    intervalBuilder.build(document.start, document.end, function(err, outages, downtime, testedTime) {
      if (err) return next(err);
      stat.outages = outages;
      stat.downtime = downtime;
      stat.availability = testedTime != 0 ? (testedTime - downtime) / testedTime : 0;
      CheckDailyStat.update(
        { check: document._id, timestamp: document.start },
        { $set: stat },
        { upsert: true },
        next
      );
    });
  }, callback);
};

QosAggregator.prototype.updateDailyTagQos = function(start, end, callback) {
  async.waterfall([
    function (next) { next(null, start, end) }, // pass the parameters to the next function
    this.aggregateTagHourlyStatsByTag,
    this.createTagDailyStats.bind(this)
  ], callback);
};

QosAggregator.prototype.aggregateTagHourlyStatsByTag = function(start, end, callback) {
  var TagHourlyStat = require('../models/tagHourlyStat');
  TagHourlyStat.aggregate(
    { $match: { 
      timestamp: { $gte: start, $lte: end }
    } },
    { $sort: {
      timestamp: 1 
    } },
    { $group: {
      _id: "$name",
      count: { $sum: "$count" },
      responsiveness: { $avg: "$responsiveness" },
      responseTime: { $avg: "$responseTime" },
      start: { $first: start.valueOf() },
      end: { $first: end.valueOf() }
    } },
    callback
  );
};

QosAggregator.prototype.createTagDailyStats = function(documents, callback) {
  var Check = require('../models/check');
  var TagDailyStat = require('../models/tagDailyStat');
  var day = 24 * 60 * 60 * 1000;
  async.forEach(documents, function(document, next) {
    var stat = {
      count: document.count,
      responsiveness: document.responsiveness,
      responseTime: document.responseTime,
    };
    var intervalBuilder = new IntervalBuilder();
    Check.findForTag(document._id, function(err, checks) {
      if (err) return next(err);
      checks.forEach(function(check) {
        intervalBuilder.addTarget(check);
      });
      intervalBuilder.build(document.start, document.end, function(err2, outages, downtime, testedTime) {
        if (err2) return next(err2);
        stat.outages = outages;
        stat.downtime = downtime;
        stat.availability = testedTime != 0 ? (testedTime - downtime) / testedTime : 0;
        TagDailyStat.update(
          { name: document._id, timestamp: document.start },
          { $set: stat },
          { upsert: true },
          next
        );
      });
    });
  }, callback);
};

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
  var start = moment(now).clone().startOf('month').toDate();
  var end   = moment(now).clone().endOf('month').toDate();
  var CheckDailyStat   = require('../models/checkDailyStat');
  var CheckMonthlyStat = require('../models/checkMonthlyStat');
  var TagDailyStat   = require('../models/tagDailyStat');
  var TagMonthlyStat = require('../models/tagMonthlyStat');
  async.series([
    async.apply(this.updateMonthlyQosStats.bind(this), start, end, CheckDailyStat, CheckMonthlyStat, "$check"),
    async.apply(this.updateMonthlyQosStats.bind(this), start, end, TagDailyStat, TagMonthlyStat, "$name"),
  ], callback);
};

QosAggregator.prototype.updateMonthlyQosStats = function(start, end, dailyStatModel, monthlyStatModel, groupIdentifier, callback) {
  callback = this.getCallback(callback);
  var key = groupIdentifier.substr(1);
  var month = end - start;
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
      availabilities: { $push: "$availability" },
      timestamps: { $push: "$timestamp" }
    } }
  ];
  dailyStatModel.aggregate(pipeline, function(err, stats) {
    if (err) return callback(err);
    var query;
    var day = 24 * 60 * 60 * 1000;
    async.forEach(stats, function(stat, cb) {
      var outages = [];
      stat.availabilities.forEach(function(availability, index) {
        var date = new Date(stat.timestamps[index]).valueOf();
        outages.push([date, date + day, availability]);
      });
      var toStatDocument = {
        end: end,
        count: stat.count,
        availability: (month - stat.downtime) / month,
        responsiveness: stat.responsiveness,
        responseTime: stat.responseTime,
        downtime: stat.downtime,
        outages: outages
      };
      query = { timestamp: start };
      query[key] = stat._id;
      monthlyStatModel.update(
        query,
        { $set: toStatDocument },
        { upsert: true },
        cb
      );
    }, callback);
  });
};

/**
 * Aggregate daily Qos data from all checks and tags around a timestamp
 * into yearly stat documents.
 *
 * The method finds the boundaries of the month
 * by resetting/completing the month of the timestamp.
 *
 * @param {Int|Date} timestamp or Date object of a moment inside the chosen month
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateYearlyQos = function(now, callback) {
  var start = moment(now).clone().startOf('year').toDate();
  var end   = moment(now).clone().endOf('year').toDate();
  var CheckMonthlyStat = require('../models/checkMonthlyStat');
  var CheckYearlyStat  = require('../models/checkYearlyStat');
  var TagMonthlyStat = require('../models/tagMonthlyStat');
  var TagYearlyStat  = require('../models/tagYearlyStat');
  async.series([
    async.apply(this.updateYearlyQosStats.bind(this), start, end, CheckMonthlyStat, CheckYearlyStat, "$check"),
    async.apply(this.updateYearlyQosStats.bind(this), start, end, TagMonthlyStat, TagYearlyStat, "$name"),
  ], callback);
};

QosAggregator.prototype.updateYearlyQosStats = function(start, end, monthlyStatModel, yearlyStatModel, groupIdentifier, callback) {
  callback = this.getCallback(callback);
  var key = groupIdentifier.substr(1);
  var month = end - start;
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
      availabilities: { $push: "$availability" },
      timestamps: { $push: "$timestamp" },
      ends: { $push: "$end" }
    } }
  ];
  monthlyStatModel.aggregate(pipeline, function(err, stats) {
    if (err) return callback(err);
    var query;
    async.forEach(stats, function(stat, cb) {
      var outages = [];
      stat.availabilities.forEach(function(availability, index) {
        var outageStart = new Date(stat.timestamps[index]).valueOf();
        var outageEnd = new Date(stat.ends[index]).valueOf();
        outages.push([outageStart, outageEnd, availability]);
      });
      var toStatDocument = {
        end: end,
        count: stat.count,
        availability: (month - stat.downtime) / month,
        responsiveness: stat.responsiveness,
        responseTime: stat.responseTime,
        downtime: stat.downtime,
        outages: outages
      };
      query = { timestamp: start };
      query[key] = stat._id;
      yearlyStatModel.update(
        query,
        { $set: toStatDocument },
        { upsert: true },
        cb
      );
    }, callback);
  });
};

/**
 * Aggregate Qos data of Pings from all checks from the last hour
 * into CheckHourlyStat and TagHourlyStat documents.
 *
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateLastHourQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 6); // 6 minutes in the past, to accommodate script running every 5 minutes
  this.updateHourlyQos(now, callback);
};

/**
 * Aggregate Qos data of CheckHourlyStat from all checks from the last day
 * into CheckDailyStat documents.
 *
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateLastDayQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accommodate script running every hour
  this.updateDailyQos(now, callback);
};

/**
 * Aggregate Qos data of CheckDailyStat from all checks from the last month
 * into CheckMonthlyStat documents.
 *
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateLastMonthQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accommodate script running every hour
  this.updateMonthlyQos(now, callback);
};

/**
 * Aggregate Qos data of CheckMonthlyStat from all checks from the last month
 * into CheckYearlyStat documents.
 *
 * @param {Function} callback(err) to be called upon completion
 *
 * @api   public
 */
QosAggregator.prototype.updateLastYearQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accommodate script running every hour
  this.updateYearlyQos(now, callback);
};

module.exports = new QosAggregator();
