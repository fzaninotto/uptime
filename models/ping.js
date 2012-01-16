var mongoose = require('mongoose'),
    Schema   = mongoose.Schema;

var Ping = new Schema({
    date         : { type: Date, default: Date.now }
  , isUp         : Boolean  // false if ping returned a non-OK status code or timed out
  , isResponsive : Boolean  // true if the ping time is less than the check max time 
  , time         : Number
  , check        : Schema.ObjectId
  , tags         : [String]
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
  ping.tags = check.tags;
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

Ping.statics.mapCheckAndTags = function() {
  var qos = { count: 1, ups: this.isUp ? 1 : 0 , responsives: this.isResponsive ? 1 : 0, time: this.time, downtime: this.downtime ? this.downtime : 0 };
  emit(this.check, qos);
  if (!this.tags) return;
  for (index in this.tags) {
    emit(this.tags[index], qos);
  }
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

Ping.statics.getQosForPeriod = function(start, end, callback) {
  this.collection.mapReduce(
    this.mapCheckAndTags.toString(),
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
  var Check = require('../models/check');
  var Tag   = require('../models/tag');
  this.getQosForPeriod(start, end, function(err, results) {
    if (err) return;
    results.forEach(function(result) {
      if (result._id.substr) {
        // the key is a string, so it's a tag
        Tag.findOneOrCreate({ name: result._id }, function(err, tag) {
          if (err || !tag) return;
          if (!tag.qosPerHour) tag.qosPerHour = {};
          tag.qosPerHour[start.toString()] = result.value;
          tag.markModified('qosPerHour');
          tag.save(callback);
        });
      } else {
        // the key is a check
        Check.findById(result._id, function (err, check) {
          if (err || !check) return;
          if (!check.qosPerHour) check.qosPerHour = {};
          check.qosPerHour[start.toString()] = result.value;
          check.markModified('qosPerHour');
          check.save(callback);
        });
      }
    });
  });
}

Ping.statics.updateLast24HoursQos = function(callback) {
  var start = new Date(Date.now() - (24 * 60 * 60 * 1000));
  var end   = new Date();
  var Check = require('../models/check');
  var Tag   = require('../models/tag');
  this.getQosForPeriod(start, end, function(err, results) {
    if (err) return;
    results.forEach(function(result) {
      if (result._id.substr) {
        // the key is a string, so it's a tag
        Tag.findOneOrCreate({ name: result._id }, function(err, tag) {
          if (err || !tag) return;
          tag.qos = result.value;
          tag.markModified('qos');
          tag.save(callback);
        });
      } else {
        // the key is a check
        Check.findById(result._id, function (err, check) {
          if (err || !check) return;
          check.qos = result.value;
          check.markModified('qos');
          check.save(callback);
        });
      }
    })
  });
}

module.exports = mongoose.model('Ping', Ping);
