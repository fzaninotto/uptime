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

exports.Ping = mongoose.model('Ping', Ping);
