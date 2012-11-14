var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var TimeCalculator = require('../lib/timeCalculator');
var async    = require('async');

// model dependencies
var TagHourlyStat    = require('../models/tagHourlyStat');
var TagDailyStat     = require('../models/tagDailyStat');
var TagMonthlyStat   = require('../models/tagMonthlyStat');
var TagYearlyStat    = require('../models/tagYearlyStat');
var Check            = require('../models/check');
var CheckMonthlyStat = require('../models/checkMonthlyStat');

// main model
var Tag = new Schema({
  name           : String,
  firstTested    : Date,
  lastUpdated    : Date,
  count          : Number,
  availability   : Number,
  responsiveness : Number,
  responseTime   : Number,
  downtime       : Number,
  outages        : Array,
});
Tag.index({ name: 1 }, { unique: true });
Tag.plugin(require('mongoose-lifecycle'));

Tag.pre('remove', function(next) {
  this.removeStats(function() {
    next();
  });
});

Tag.methods.removeStats = function(callback) {
  var self = this;
  async.parallel([
    function(cb) { TagHourlyStat.remove({ name: self.name }, cb); },
    function(cb) { TagDailyStat.remove({ name: self.name }, cb); },
    function(cb) { TagMonthlyStat.remove({ name: self.name }, cb); }
  ], callback);
};

Tag.methods.getChecks = function(callback) {
  var Check   = require('./check')
  Check.find({ tags: this.name }, callback);
}

Tag.methods.getFirstTested = function(callback) {
  var firstTested = Infinity;
  this.getChecks(function(err, checks) {
    checks.forEach(function(check) {
      if (!check.firstTested) return;
      firstTested = Math.min(firstTested, check.firstTested);
    });
    callback(err, firstTested);
  });
}

var statProvider = {
  '1h':  'TagHourlyStat',
  '6h':  'TagHourlyStat',
  '1d':  'TagHourlyStat',
  '7d':  'TagHourlyStat',
  'MTD': 'TagDailyStat',
  '1m':  'TagDailyStat',
  '3m':  'TagDailyStat',
  '6m':  'TagMonthlyStat',
  'YTD': 'TagMonthlyStat',
  '1y':  'TagMonthlyStat',
  '3y':  'TagMonthlyStat'
};

var statProvider = {
  'day':   { model: 'TagHourlyStat', beginMethod: 'resetDay', endMethod: 'completeDay', duration: 60 * 60 * 1000 },
  'month': { model: 'TagDailyStat', beginMethod: 'resetMonth', endMethod: 'completeMonth', duration: 24 * 60 * 60 * 1000 },
  'year':  { model: 'TagMonthlyStat', beginMethod: 'resetYear', endMethod: 'completeYear' }
};

Tag.methods.getStatsForPeriod = function(period, begin, end, callback) {
  var periodPrefs = statProvider[period];
  var stats = [];
  var query = { name: this.name, timestamp: { $gte: begin, $lte: end } };
  var stream = this.db.model(periodPrefs['model']).find(query).sort({ timestamp: -1 }).stream();
  stream.on('error', function(err) {
    callback(err);
  }).on('data', function(stat) {
    stats.push({
      timestamp: Date.parse(stat.timestamp),
      availability: (stat.availability * 100).toFixed(3),
      responsiveness: (stat.responsiveness * 100).toFixed(3),
      downtime: parseInt(stat.downtime / 1000),
      responseTime: parseInt(stat.responseTime),
      outages: stat.outages || [],
      end: stat.end ? stat.end.valueOf() : (Date.parse(stat.timestamp) + periodPrefs['duration'])
    });
  }).on('close', function() {
    callback(null, stats);
  });
}

var singleStatsProvider = {
  'hour': { model: 'TagHourlyStat', beginMethod: 'resetHour', endMethod: 'completeHour' },
  'day':  { model: 'TagDailyStat', beginMethod: 'resetDay', endMethod: 'completeDay' },
  'month': { model: 'TagMonthlyStat', beginMethod: 'resetMonth', endMethod: 'completeMonth' },
  'year': { model: 'TagYearlyStat', beginMethod: 'resetYear', endMethod: 'completeYear' }
};

Tag.methods.getSingleStatsForPeriod = function(period, date, callback) {
  var periodPrefs = singleStatsProvider[period];
  var begin = TimeCalculator[periodPrefs['beginMethod']](date);
  var end = TimeCalculator[periodPrefs['endMethod']](date);
  var query = { name: this.name, timestamp: { $gte: begin, $lte: end } };
  this.db.model(periodPrefs['model']).findOne(query, function(err, stat) {
    if (err || !stat) return callback(err);
    return callback(null, {
      timestamp: Date.parse(stat.timestamp),
      availability: (stat.availability * 100).toFixed(3),
      responsiveness: (stat.responsiveness * 100).toFixed(3),
      downtime: stat.downtime / 1000,
      responseTime: Math.round(stat.responseTime),
      outages: stat.outages || [],
      begin: begin.valueOf(),
      end: end.valueOf()
    })
  });
}

Tag.methods.getMonths = function(callback) {
  TagMonthlyStat
  .find({ name: this.name })
  .sort({ timestamp: 1 })
  .select('timestamp')
  .findOne(function(err, stat) {
    if (err) return callback(err);
    if (!stat) return callback(null, []);
    var months = [];
    var now = Date.now();
    var date = new Date(stat.timestamp);
    do {
      months.push(date.getTime());
      if (date.getMonth() == 11) {
        date.setMonth(0);
        date.setFullYear(date.getFullYear() +1);
      } else {
        date.setMonth(date.getMonth() + 1);
      }
    } while (date.getTime() < now);
    callback(null, months);
  });
}

Tag.methods.getMonthlyReport = function(date, callback) {
  var tag = this;
  var begin = TimeCalculator.resetMonth(date);
  var end = TimeCalculator.completeMonth(date);
  async.parallel({
    tagMonthlyStat: function(cb) {
      TagMonthlyStat.findOne({ name: tag.name, timestamp: begin }, cb);
    },
    tagDailyStats: function(cb) {
      TagDailyStat.find({ name: tag.name, timestamp: { $gte: begin, $lte: end }}).sort({ timestamp: 1 }).exec(cb);
    },
    checkStats: function(cb) {
      Check.find({ tags: tag.name }).exec(function(getCheckErr, checks) {
        CheckMonthlyStat.find({ check: { $in: checks }, timestamp: { $gte: begin, $lte: end }}).sort({ downtime: -1 }).populate('check', ['name']).exec(cb);
      });
    }
  }, function(err, results) {
    if (err) return callback(err);
    results.begin = begin;
    results.end = end;
    results.tag = tag;
    callback(null, results);
  });
}

Tag.statics.ensureTagsHaveFirstTestedDate = function(tags, callback) {
  var tagsWithoutFirstTestedDate = [];
  tags.forEach(function(tag) {
    if (!tag.firstTested) tagsWithoutFirstTestedDate.push(tag);
  });
  if (tagsWithoutFirstTestedDate.length == 0) return callback();
  async.forEach(
    tagsWithoutFirstTestedDate,
    function(tag, next) {
      tag.getFirstTested(function(err, firstTested) {
        tag.firstTested = firstTested;
        tag.save(next);
      });
    },
    callback
  );
}

module.exports = mongoose.model('Tag', Tag);