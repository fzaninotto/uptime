var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// main model
var CheckHourlyStat = new Schema({
    check       : Schema.ObjectId
  , timestamp   : Date
  , count       : Number
  , ups         : Number
  , responsives : Number
  , time        : Number
  , downtime    : Number
});
CheckHourlyStat.index({ check: 1, timestamp: -1 }, { unique: true });

CheckHourlyStat.statics.map = function() {
  var qos = { count: 1, ups: this.ups , responsives: this.responsives, time: this.time, downtime: this.downtime };
  emit(this.check, qos);
}

CheckHourlyStat.statics.reduce = function(key, values) {
  var result = { count: 0, ups: 0, responsives: 0, time: 0, downtime: 0 };
  values.forEach(function(value) {
    result.count       += value.count;
    result.ups         += value.ups;
    result.responsives += value.responsives;
    result.time        += value.time;
    result.downtime    += value.downtime;
  });
  return result;
}

CheckHourlyStat.statics.getQosForPeriod = function(start, end, callback) {
  this.collection.mapReduce(
    this.map.toString(),
    this.reduce.toString(),
    { query: { timestamp: { $gte: start, $lte: end } }, out: { inline: 1 } },
    callback
  );
}

CheckHourlyStat.statics.updateDailyQos = function(now, callback) {
  if ('undefined' == typeof callback) {
    // Mogoose Model.update() implementation requires a callback
    callback = function(err) { if (err) console.dir(err); };
  }
  var start = new Date(now);
  start.setUTCHours(0);
  start.setUTCMinutes(0);
  start.setUTCSeconds(0);
  start.setUTCMilliseconds(0);
  var end = new Date(start);
  end.setUTCHours(23);
  end.setUTCMinutes(59);
  end.setUTCSeconds(59);
  end.setUTCMilliseconds(999);
  var CheckDailyStat = require('./checkDailyStat');
  this.getQosForPeriod(start, end, function(err, results) {
    if (err) return;
    results.forEach(function(result) {
      var stat = result.value;
      CheckDailyStat.update({ check: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, callback);
    });
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
  var start = new Date(now);
  start.setUTCDate(1);
  start.setUTCHours(0);
  start.setUTCMinutes(0);
  start.setUTCSeconds(0);
  start.setUTCMilliseconds(0);
  var end = new Date(start);
  if (start.getUTCMonth() == 11) {
    end.setUTCMonth(0);
    end.setUTCFullYear(start.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(start.getUTCMonth() + 1);
  }
  var CheckMonthlyStat = require('./checkMonthlyStat');
  this.getQosForPeriod(start, end, function(err, results) {
    if (err) return;
    results.forEach(function(result) {
      var stat = result.value;
      CheckMonthlyStat.update({ check: result._id, timestamp: start }, { $set: { count: stat.count, ups: stat.ups, responsives: stat.responsives, time: stat.time, downtime: stat.downtime } }, { upsert: true }, callback);
    });
  });
}

CheckHourlyStat.statics.updateLastMonthQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 66); // 1 hour and 6 minutes in the past, to accomodate script running every hour
  this.updateMonthlyQos(now, callback);
}

module.exports = mongoose.model('CheckHourlyStat', CheckHourlyStat);