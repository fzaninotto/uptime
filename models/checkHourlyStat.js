var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var TimeCalculator = require('../lib/timeCalculator');
var QosAggregator = require('../lib/qosAggregator');
var async = require('async');

// main model
var CheckHourlyStat = new Schema({
  check       : { type: Schema.ObjectId, ref: 'Check' },
  timestamp   : Date,
  count       : Number,
  ups         : Number,
  responsives : Number,
  time        : Number,
  downtime    : Number,
  periods     : Array
});
CheckHourlyStat.index({ check: 1, timestamp: -1 }, { unique: true });
CheckHourlyStat.plugin(require('mongoose-lifecycle'));

var mapCheck = function() {
  var qos = { count: this.count, ups: this.ups , responsives: this.responsives, time: this.time, downtime: this.downtime };
  emit(this.check, qos);
};

CheckHourlyStat.statics.updateDailyQos = function(now, callback) {
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    callback = function(err) { if (err) console.dir(err); };
  }
  var start = TimeCalculator.resetDay(now);
  var end   = TimeCalculator.completeDay(now);
  var CheckDailyStat = require('./checkDailyStat');
  QosAggregator.getQosForPeriod(this.collection, mapCheck, start, end, function(err, results) {
    if (err) return;
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      CheckDailyStat.update({ check: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
    }, callback);
  });
}

CheckHourlyStat.statics.updateLastDayQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accomodate script running every hour
  this.updateDailyQos(now, callback);
}

CheckHourlyStat.statics.updateMonthlyQos = function(now, callback) {
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    callback = function(err) { if (err) console.dir(err); };
  }
  var start = TimeCalculator.resetMonth(now);
  var end   = TimeCalculator.completeMonth(now);
  var CheckMonthlyStat = require('./checkMonthlyStat');
  QosAggregator.getQosForPeriod(this.collection, mapCheck, start, end, function(err, results) {
    if (err) return;
    async.forEach(results, function(result, cb) {
      var stat = result.value;
      CheckMonthlyStat.update({ check: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, cb);
    }, callback);
  });
}

CheckHourlyStat.statics.updateLastMonthQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accomodate script running every hour
  this.updateMonthlyQos(now, callback);
}

module.exports = mongoose.model('CheckHourlyStat', CheckHourlyStat);