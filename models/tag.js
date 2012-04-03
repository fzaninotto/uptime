var mongoose = require('mongoose'),
    Schema = mongoose.Schema
    TimeCalculator = require('../lib/timeCalculator'),
    async    = require('async');

// model dependencies
var TagHourlyStat  = require('../models/tagHourlyStat');
var TagDailyStat   = require('../models/tagDailyStat');
var TagMonthlyStat = require('../models/tagMonthlyStat');

// main model
var Tag = new Schema({
    name        : String
  , lastUpdated : Date
  , count       : Number
  , ups         : Number
  , responsives : Number
  , time        : Number
  , downtime    : Number
});
Tag.index({ name: 1 }, { unique: true });
Tag.plugin(require('../lib/lifecycleEventsPlugin'));

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

Tag.methods.getStatsForPeriod = function(period, page, callback) {
  var boundary = TimeCalculator.boundaryFunction[period];
  var stats = [];
  var query = { name: this.name, timestamp: { $gte: boundary(page), $lte: boundary(page - 1) } };
  this.db.model(statProvider[period]).find(query).asc('timestamp').each(function(err, stat) {
    if (stat) {
      stats.push({
        timestamp: Date.parse(stat.timestamp),
        uptime: (stat.ups / stat.count).toFixed(5) * 100,
        responsiveness: (stat.responsives / stat.count).toFixed(5) * 100,
        downtime: stat.downtime / 1000,
        responseTime: Math.round(stat.time / stat.count)
      });
    } else {
      callback(stats);
    }
  });
}

module.exports = mongoose.model('Tag', Tag);
