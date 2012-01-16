var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// models dependencies
var Ping   = require('../models/ping');

// main model
var Check = new Schema({
    name        : String
  , url         : String
  , interval    : { type: Number, default: 60000 }  // interval between two pings
  , maxTime     : { type: Number, default: 1500 }   // time under which a ping is considered responsive
  , tags        : [String]
  , lastChanged : Date
  , lastTested  : Date
  , isUp        : Boolean
  , uptime      : { type: Number, default: 0 }
  , downtime    : { type: Number, default: 0 }
  , qos         : {}
  , qosPerHour  : {}
});

Check.methods.setLastTest = function(status) {
  var now = new Date();
  if (this.isUp != status) {
    this.lastChanged = now;
    this.isUp = status;
    this.uptime = 0;
    this.downtime = 0;
  }
  var durationSinceLastChange = now.getTime() - this.lastChanged.getTime();
  if (status) {
    this.uptime = durationSinceLastChange;
  } else {
    this.downtime = durationSinceLastChange;
  }
  return this;
}

Check.methods.getQosPercentage = function() {
  if (!this.qos) return false;
  return (this.qos.ups / this.qos.count) * 100;
}

Check.methods.updateQos = function(callback) {
  var check = this;
  Ping.countForCheck(check, new Date(Date.now() - (24 * 60 * 60 * 1000)), new Date(), function(err, result) {
    if (err || !(0 in result)) return;
    check.qos = result[0].value;
    check.markModified('qos');
    check.save(callback);
  });
}

Check.namedScope('byUptime', function(order) {
  if (typeof order == 'undefined' || order == 'asc') {
    // return first checks that are down since a long time,
    // then the ones down since not that long,
    // then the ones up since not that long,
    // then the ones up since a long time
    // useful for monitoring
    return this.find({}).desc('downtime').asc('uptime');
  } else {
    // return first atrgets that are up since a long time
    // then the ones up since not that long
    // then the ones down since not that long
    // then the ones down since a long time
    // useful to see the most stable services
    return this.find({}).desc('uptime').asc('downtime');
  }
});

/**
 * Calls a function for all checks that need to be polled.
 *
 * A check needs to be polled if it was last polled sine a longer time than its own interval.
 * This method uses Mongoose streaming cursor interface (Query.each())
 *
 * @param {Function} Callback function to be called with each Check
 * @api   public
 */
Check.statics.callForChecksNeedingPoll = function(callback) {
  this.find().$where(function() {
    return (Date.now() - this.lastTested.getTime()) > (this.interval || 60000);
  }).each(callback);
}

Check.statics.updateAllQos = function(callback) {
  this.find({}).each(function (err, check) {
    if(err || !check) return;
    check.updateQos(callback);
  });
}

module.exports = mongoose.model('Check', Check);
