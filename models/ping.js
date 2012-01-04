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

exports.Ping = mongoose.model('Ping', Ping);
