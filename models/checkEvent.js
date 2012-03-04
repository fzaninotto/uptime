var mongoose = require('mongoose'),
    Schema   = mongoose.Schema;

var CheckEvent = new Schema({
    timestamp   : { type: Date, default: Date.now }
  , check       : { type: Schema.ObjectId, ref: 'Check' }
  , tags        : [String]
  , isGoDown    : Boolean // true if the event is for a check going DOWN, false if it is for a check going back UP
  // for error events, more details need to be persisted
  , downtime    : Number
});
CheckEvent.index({ check: 1, timestamp: -1 });

module.exports = mongoose.model('CheckEvent', CheckEvent);