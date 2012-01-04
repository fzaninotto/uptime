var mongoose = require('mongoose'),
    Schema   = mongoose.Schema;

var Ping = new Schema({
    date   : { type: Date, default: Date.now }
  , isUp   : Boolean
  , target : Schema.ObjectId
});

Ping.methods.findTarget = function(callback) {
  return this.db.model('Target').findById(this.target, callback);
}

Ping.statics.createForTarget = function(target, status, callback) {
  ping = new this();
  ping.target = target;
  ping.isUp = status;
  ping.save(callback);
}

Ping.statics.countForTarget = function(target, start, end, callback) {
  var mapFunction = function() {
    emit(this.target, { count: 1, ups: this.isUp ? 1 : 0 } )
  }
  var reduceFunction = function(key, values) {
    var result = { count: 0, ups: 0 };
    values.forEach(function(value) {
      result.count += value.count;
      result.ups   += value.ups;
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
