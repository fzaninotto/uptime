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

CheckEvent.statics.aggregateEventsByDay = function(events) {
  var currentDay;
  var aggregatedEvents = {};
  var currentAggregate = [];
  events.forEach(function(event) {
    var date = new Date(event.timestamp).toLocaleDateString();
    if (date != currentDay) {
      currentDay = date;
      currentAggregate = aggregatedEvents[date] = [];
    }
    currentAggregate.push(event);
  });
  return aggregatedEvents;
}

CheckEvent.pre('save', function(next) {
  this.db.model('CheckEvent').emit('new', this);
  next();
});

module.exports = mongoose.model('CheckEvent', CheckEvent);