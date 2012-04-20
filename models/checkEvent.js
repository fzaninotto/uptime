var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var CheckEvent = new Schema({
  timestamp   : { type: Date, default: Date.now },
  check       : { type: Schema.ObjectId, ref: 'Check' },
  tags        : [String],
  message     : String,
  details     : String,
  // for error events, more details need to be persisted
  downtime    : Number
});
CheckEvent.index({ check: 1, timestamp: -1 });
CheckEvent.plugin(require('../lib/lifecycleEventsPlugin'));

CheckEvent.methods.findCheck = function(callback) {
  return this.db.model('Check').findById(this.check, callback);
}

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

CheckEvent.statics.cleanup = function(maxAge, callback) {
  oldestDateToKeep = new Date(Date.now() - (maxAge ||  3 * 31 * 24 * 60 * 60 * 1000));
  this.find({ timestamp: { $lt: oldestDateToKeep } }).remove(callback);
}

module.exports = mongoose.model('CheckEvent', CheckEvent);