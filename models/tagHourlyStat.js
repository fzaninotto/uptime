var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var TimeCalculator = require('../lib/timeCalculator');
var QosAggregator = require('../lib/qosAggregator');
var async    = require('async');

// main model
var TagHourlyStat = new Schema({
  name        : String,
  timestamp   : Date,
  count       : Number,
  ups         : Number,
  responsives : Number,
  time        : Number,
  downtime    : Number
});
TagHourlyStat.index({ name: 1, timestamp: -1 }, { unique: true });
TagHourlyStat.plugin(require('../lib/lifecycleEventsPlugin'));

var mapTag = function() {
  var qos = { count: this.count, ups: this.ups , responsives: this.responsives, time: this.time, downtime: this.downtime };
  emit(this.name, qos);
};

TagHourlyStat.statics.updateDailyQos = function(now, callback) {
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    callback = function(err) { if (err) console.dir(err); };
  }
  var start = TimeCalculator.resetDay(now);
  var end   = TimeCalculator.completeDay(now);
  var TagDailyStat = require('./tagDailyStat');
  QosAggregator.getQosForPeriod(this.collection, mapTag, start, end, function(err, results) {
    if (err) return;
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      TagDailyStat.update({ name: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
    }, callback);
  });
}

TagHourlyStat.statics.updateLastDayQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accomodate script running every hour
  this.updateDailyQos(now, callback);
}

TagHourlyStat.statics.updateMonthlyQos = function(now, callback) {
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    callback = function(err) { if (err) console.dir(err); };
  }
  var start = TimeCalculator.resetMonth(now);
  var end   = TimeCalculator.completeMonth(now);
  var TagMonthlyStat = require('./tagMonthlyStat');
  QosAggregator.getQosForPeriod(this.collection, mapTag, start, end, function(err, results) {
    if (err) return;
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      TagMonthlyStat.update({ name: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
    }, callback);
  });
}

TagHourlyStat.statics.updateLastMonthQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accomodate script running every hour
  this.updateMonthlyQos(now, callback);
}

module.exports = mongoose.model('TagHourlyStat', TagHourlyStat);