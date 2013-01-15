var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var CheckEvent = new Schema({
  timestamp   : { type: Date, default: Date.now },
  check       : { type: Schema.ObjectId, ref: 'Check' },
  tags        : [String],
  message     : String, // possible values are 'down', 'up', 'paused', 'restarted'
  details     : String,
  // for error events, more details need to be persisted
  downtime    : Number
});
CheckEvent.index({ check: 1, timestamp: -1 });
CheckEvent.plugin(require('mongoose-lifecycle'));

CheckEvent.methods.findCheck = function(callback) {
  return this.db.model('Check').findById(this.check, callback);
};

CheckEvent.statics.aggregateEventsByDay = function(events, callback) {
  // list checks concerned by all events
  var checkIds = [];
  events.forEach(function(event) {
    var check = event.check.toString();
    if (checkIds.indexOf(check) == -1) checkIds.push(check);
  });
  this.db.model('Check').find({ _id: { $in: checkIds } }).select({ _id: 1, name: 1, url: 1 }).exec(function(err, checks) {
    // populate related check for each event
    if (err) return callback(err);
    var indexedChecks = {};
    checks.forEach(function(check) {
      indexedChecks[check._id] = check;
    });
    events.forEach(function(event, index) {
      event = event.toJSON(); // bypass mongoose's magic setters
      event.check = indexedChecks[event.check];
      delete event.__v;
      delete event._id;
      if (event.message == 'up') {
        delete event.details;
      }
      events[index] = event;
    });

    // aggregate events by day
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
    callback(null, aggregatedEvents);
  });
};

CheckEvent.statics.cleanup = function(maxAge, callback) {
  var oldestDateToKeep = new Date(Date.now() - (maxAge ||  3 * 31 * 24 * 60 * 60 * 1000));
  this.find({ timestamp: { $lt: oldestDateToKeep } }).remove(callback);
};

module.exports = mongoose.model('CheckEvent', CheckEvent);
