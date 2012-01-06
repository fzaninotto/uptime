var mongoose = require('mongoose'),
    Schema   = mongoose.Schema;

var Ping = new Schema({
    date         : { type: Date, default: Date.now }
  , isUp         : Boolean  // false if ping returned a non-OK status code or timed out
  , isResponsive : Boolean  // true if the ping time is less than the check max time 
  , time         : Number
  , check        : Schema.ObjectId
});

Ping.methods.findCheck = function(callback) {
  return this.db.model('Check').findById(this.check, callback);
}

Ping.statics.createForCheck = function(check, status, time, callback) {
  ping = new this();
  ping.check = check;
  ping.isUp = status;
  ping.time = time;
  if (status && check.maxTime) {
    ping.isResponsive = time < check.maxTime;
  } else {
    ping.isResponsive = false;
  }
  ping.save(callback);
}

Ping.statics.countForCheck = function(check, start, end, callback) {
  var mapFunction = function() {
    emit(this.check, { count: 1, ups: this.isUp ? 1 : 0 , responsives: this.isResponsive ? 1 : 0 } )
  }
  var reduceFunction = function(key, values) {
    var result = { count: 0, ups: 0, responsives: 0 };
    values.forEach(function(value) {
      result.count       += value.count;
      result.ups         += value.ups;
      result.responsives += value.responsives;
    });
    return result;
  }
  this.collection.mapReduce(
    mapFunction.toString(),
    reduceFunction.toString(),
    { query: { check: check._id, date: { $gte: start }, date: { $lte: end } }, out: { inline: 1 } },
    callback
  );
}

exports.Ping = mongoose.model('Ping', Ping);
