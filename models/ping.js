var mongoose = require('mongoose'),
    Schema   = mongoose.Schema;

var Ping = new Schema({
    date         : { type: Date, default: Date.now }
  , isUp         : Boolean  // false if ping returned a non-OK status code or timed out
  , isResponsive : Boolean  // true if the ping time is less than the check max time 
  , time         : Number
  , check        : Schema.ObjectId
  // for pings in error, more details need to be persisted
  , downtime     : Number   // time since last ping if the ping is down
  , error        : String
});

Ping.methods.findCheck = function(callback) {
  return this.db.model('Check').findById(this.check, callback);
}

Ping.statics.createForCheck = function(check, status, time, error, callback) {
  check.setLastTest(status).save();
  ping = new this();
  ping.check = check;
  ping.isUp = status;
  ping.time = time;
  if (status && check.maxTime) {
    ping.isResponsive = time < check.maxTime;
  } else {
    ping.isResponsive = false;
  }
  if (!status) {
    ping.downtime = check.interval || 60000;
    ping.error = error;
  };
  ping.save(callback);
}

Ping.statics.mapCheck = function() {
  emit(this.check, { count: 1, ups: this.isUp ? 1 : 0 , responsives: this.isResponsive ? 1 : 0, time: this.time, downtime: this.downtime ? this.downtime : 0 } );
}

Ping.statics.reduce = function(key, values) {
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

Ping.statics.countForCheck = function(check, start, end, callback) {
  this.collection.mapReduce(
    this.mapCheck.toString(),
    this.reduce.toString(),
    { query: { check: check._id, date: { $gte: start, $lte: end } }, out: { inline: 1 } },
    callback
  );
}

Ping.statics.groupPeriodByCheck = function(start, end, callback) {
  this.collection.mapReduce(
    this.mapCheck.toString(),
    this.reduce.toString(),
    { query: { date: { $gte: start, $lte: end } }, out: { inline: 1 } },
    callback
  );
}

Ping.statics.updateLastHourQos = function(callback) {
  var now = new Date(Date.now() - 1000 * 60 * 6); // 6 minutes in the past, to accomodate script running every 5 minutes
  var start = new Date(now);
  start.setUTCMinutes(0);
  start.setUTCSeconds(0);
  start.setUTCMilliseconds(0);
  var end = new Date(start);
  end.setUTCMinutes(59);
  end.setUTCSeconds(59);
  end.setUTCMilliseconds(999);
  var Check = require('../models/check').Check;
  this.groupPeriodByCheck(start, end, function(err, results) {
    if (err) return;
    results.forEach(function(result) {
      Check.findById(result._id, function (err, check) {
        if (!check.qosPerHour) check.qosPerHour = {};
        check.qosPerHour[start.toString()] = result.value;
        check.markModified('qosPerHour');
        check.save(callback);
      });
    });
  });
}


exports.Ping = mongoose.model('Ping', Ping);
