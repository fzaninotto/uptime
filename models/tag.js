var mongoose = require('mongoose'),
    Schema = mongoose.Schema
    TimeCalculator = require('../lib/timeCalculator');

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

Tag.methods.getChecks = function(callback) {
  var Check   = require('./check')
  Check.find({ tags: this.name }, callback);
}

var qosParams = {
  '6h':  { type: 'TagHourlyStat', fromDate: new Date(Date.now() -                 6 * 60 * 60 * 1000) },
  '1d':  { type: 'TagHourlyStat', fromDate: new Date(Date.now() -                25 * 60 * 60 * 1000) },
  '7d':  { type: 'TagHourlyStat', fromDate: new Date(Date.now() -            8 * 24 * 60 * 60 * 1000) },
  'MTD': { type: 'TagHourlyStat', fromDate: TimeCalculator.resetMonth(new Date()) },
  '1m':  { type: 'TagHourlyStat', fromDate: new Date(Date.now() -           31 * 24 * 60 * 60 * 1000) },
  '3m':  { type: 'TagHourlyStat', fromDate: new Date(Date.now() -       3 * 31 * 24 * 60 * 60 * 1000) },
  '6m':  { type: 'TagHourlyStat', fromDate: new Date(Date.now() -       6 * 31 * 24 * 60 * 60 * 1000) },
  'YTD': { type: 'TagHourlyStat', fromDate: TimeCalculator.resetYear(new Date()) },
  '1y':  { type: 'TagHourlyStat', fromDate: new Date(Date.now() -      12 * 31 * 24 * 60 * 60 * 1000) },
  'max': { type: 'TagHourlyStat', fromDate: new Date(Date.now() - 10 * 12 * 31 * 24 * 60 * 60 * 1000) },
};

Tag.methods.getUptimeForPeriod = function(period, callback) {
  var qosParam = qosParams[period];
  var uptimes = [];
  this.db.model(qosParam.type).find({ name: this.name, timestamp: { $gte: qosParam.fromDate } }).asc('timestamp').each(function(err, stat) {
    if (stat) {
      uptimes.push([Date.parse(stat.timestamp), (stat.ups / stat.count).toFixed(5) * 100]);
    } else {
      callback(uptimes);
    }
  });
}

Tag.methods.getResponseTimeForPeriod = function(period, callback) {
  var qosParam = qosParams[period];
  var responseTimes = [];
  this.db.model(qosParam.type).find({ name: this.name, timestamp: { $gte: qosParam.fromDate } }).asc('timestamp').each(function(err, stat) {
    if (stat) {
      responseTimes.push([Date.parse(stat.timestamp), Math.round(stat.time / stat.count)]);
    } else {
      callback(responseTimes);
    }
  });
}

module.exports = mongoose.model('Tag', Tag);
