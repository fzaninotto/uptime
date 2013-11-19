var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var Ping = new Schema({
  timestamp    : { type: Date, default: Date.now },
  isUp         : Boolean,  // false if ping returned a non-OK status code or timed out
  isResponsive : Boolean,  // true if the ping time is less than the check max time 
  time         : Number,
  check        : { type: Schema.ObjectId, ref: 'Check' },
  tags         : [String],
  monitorName  : String,
  // for pings in error, more details need to be persisted
  downtime     : Number,   // time since last ping if the ping is down
  error        : String,
  details      : Schema.Types.Mixed
});
Ping.index({ timestamp: -1 });
Ping.index({ check: 1 });
Ping.plugin(require('mongoose-lifecycle'));

Ping.methods.findCheck = function(callback) {
  return this.db.model('Check').findById(this.check, callback);
};

Ping.methods.setDetails = function(details) {
  this.details = details;
  this.markModified('details');
};

Ping.statics.createForCheck = function(status, timestamp, time, check, monitorName, error, details, callback) {
  timestamp = (timestamp.length) ? new Date(parseInt(timestamp, 10)) : new Date();
  var ping = new this();
  ping.timestamp = timestamp;
  ping.isUp = status;
  if (status && check.maxTime) {
    ping.isResponsive = time < check.maxTime;
  } else {
    ping.isResponsive = false;
  }
  ping.time = time;
  ping.check = check;
  ping.tags = check.tags;
  ping.monitorName = monitorName;
  if (!status) {
    ping.downtime = check.interval || 60000;
    ping.error = error;
  }
  if (details) {
    ping.setDetails(JSON.parse(details));
  }
  ping.save(function(err1) {
    if (err1) return callback(err1);
    check.setLastTest(status, timestamp, error);
    check.save(function(err2) {
      if (err2) return callback(err2);
      callback(null, ping);
    });
  });
};

Ping.statics.cleanup = function(maxAge, callback) {
  var oldestDateToKeep = new Date(Date.now() - (maxAge ||  3 * 31 * 24 * 60 * 60 * 1000));
  this.find({ timestamp: { $lt: new Date(oldestDateToKeep) } }).remove(callback);
};

module.exports = mongoose.model('Ping', Ping);
