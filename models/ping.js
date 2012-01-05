var mongoose = require('mongoose'),
    Schema   = mongoose.Schema;

var Ping = new Schema({
    date         : { type: Date, default: Date.now }
  , isUp         : Boolean  // false if ping returned a non-OK status code or timed out
  , isResponsive : Boolean  // true if the ping time is less than the target max time 
  , time         : Number
  , target       : Schema.ObjectId
});

Ping.methods.findTarget = function(callback) {
  return this.db.model('Target').findById(this.target, callback);
}

Ping.statics.createForTarget = function(target, status, time, callback) {
  ping = new this();
  ping.target = target;
  ping.isUp = status;
  ping.time = time;
  if (status && target.maxTime) {
    ping.isResponsive = time < target.maxTime;
  } else {
    ping.isResponsive = false;
  }
  ping.save(callback);
}

Ping.statics.countForTarget = function(target, start, end, callback) {
  var mapFunction = function() {
    emit(this.target, { count: 1, ups: this.isUp ? 1 : 0 , responsives: this.isResponsive ? 1 : 0 } )
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
    { query: { target: target._id, date: { $gte: start }, date: { $lte: end } }, out: { inline: 1 } },
    callback
  );
}

exports.Ping = mongoose.model('Ping', Ping);
