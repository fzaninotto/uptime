var mongoose = require('mongoose'),
    Schema   = mongoose.Schema;

var Ping = new Schema({
    date   : Date
  , isUp   : Boolean
  , target : Schema.ObjectId
});

Ping.methods.findTarget = function(callback) {
  return this.db.model('Target').findById(this.target, callback);
}

Ping.statics.createForTarget = function(target, status, callback) {
  ping = new this();
  ping.date = Date.now();
  ping.target = target;
  ping.isUp = status;
  ping.save(callback);
}

Ping.statics.countForTarget = function(target, callback) {
  this.collection.mapReduce(
    mapFunction.toString(),
    reduceFunction.toString(),
    { query: { target: target._id }, out: { inline: 1 } }, 
    callback
  );
}

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

exports.Ping = mongoose.model('Ping', Ping);
