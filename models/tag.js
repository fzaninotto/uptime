var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var TimeCalculator = require('../lib/timeCalculator');
var async    = require('async');

// model dependencies
var TagHourlyStat    = require('./tagHourlyStat');
var TagDailyStat     = require('./tagDailyStat');
var TagMonthlyStat   = require('./tagMonthlyStat');
var TagYearlyStat    = require('./tagYearlyStat');
var Check            = require('./check');
var CheckHourlyStat  = require('./checkHourlyStat');
var CheckDailyStat   = require('./checkDailyStat');
var CheckMonthlyStat = require('./checkMonthlyStat');
var CheckYearlyStat  = require('./checkYearlyStat');

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
  var Check   = require('./check');
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

var checkProvider = {
  'hour': { model: 'CheckHourlyStat', beginMethod: 'resetHour', endMethod: 'completeHour' },
  'day':  { model: 'CheckDailyStat', beginMethod: 'resetDay', endMethod: 'completeDay' },
  'month': { model: 'CheckMonthlyStat', beginMethod: 'resetMonth', endMethod: 'completeMonth' },
  'year': { model: 'CheckYearlyStat', beginMethod: 'resetYear', endMethod: 'completeYear' }
};

Tag.methods.getChecksForPeriod = function(period, date, callback) {
  var periodPrefs = checkProvider[period];
  var stats = {};
  var checkNames = [];
  var begin = TimeCalculator[periodPrefs['beginMethod']](date);
  var end = TimeCalculator[periodPrefs['endMethod']](date);
  var self = this;
  this.db.model('Check').find({ tags: this.name }).select('_id').exec(function(err, res) {
    if (err) return callback(err);
    var ids = [];
    res.forEach(function(doc) {
      ids.push(doc._id);
    })
    var query = { check: { $in: ids }, timestamp: { $gte: begin, $lte: end } };
    var stream = self.db.model(periodPrefs['model']).find(query).populate('check').stream();
    stream
    .on('error', callback)
    .on('data', function(stat) {
      stats[stat.check.name] = {
        timestamp: Date.parse(stat.timestamp),
        availability: (stat.availability * 100).toFixed(3),
        responsiveness: (stat.responsiveness * 100).toFixed(3),
        downtime: parseInt(stat.downtime / 1000),
        responseTime: parseInt(stat.responseTime),
        outages: stat.outages || [],
        end: stat.end ? stat.end.valueOf() : (Date.parse(stat.timestamp) + periodPrefs['duration']),
        check: stat.check
      };
      checkNames.push(stat.check.name);
    })
    .on('close', function() {
      var orderedStats = [];
      checkNames.sort();
      checkNames.forEach(function(checkName) {
        orderedStats.push(stats[checkName]);
      })
      callback(null, orderedStats);
    });
  });
}

Tag.statics.ensureTagsHaveFirstTestedDate = function(callback) {
  this.find({ firstTested: { $exists: false }}, function(err, tags) {
    if (err || !tags) return callback(err);
    async.forEach(tags, function(tag, next) {
      tag.getFirstTested(function(err2, firstTested) {
        if (err2 || firstTested == Infinity) return callback(err2);
        tag.firstTested = firstTested;
        tag.save(next);
      });
    }, callback);
  });
}

Tag.statics.removeOrphanTags = function(callback) {
  var Check = require('./check');
  this.find(function(err1, tags1) {
    if (err1) return callback(err1);
    Check.getAllTags(function(err2, tags2) {
      if (err2) return callback(err2);
      async.forEach(tags1, function(tag, next) {
        if (tags2.indexOf(tag.name) !== -1) return next();
        tag.remove(next);
      }, callback);
    });
  });
}

module.exports = mongoose.model('Tag', Tag);