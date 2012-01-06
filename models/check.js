var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// models dependencies
var Ping   = require('../models/ping').Ping;

// embedded document
var GroupMembership = new Schema({
    name   : { type: String, default: 'all' }
  , weight : { type: Number, default: 1 }
});

// main model
var Check = new Schema({
    name        : String
  , url         : String
  , maxTime     : Number             // time under which a ping is considered responsive
  , groups      : [GroupMembership]
  , lastChanged : Date
  , lastTested  : Date
  , isUp        : Boolean
  , uptime      : { type: Number, default: 0 }
  , downtime    : { type: Number, default: 0 }
  , qos         : {}
});

Check.methods.setLastTest = function(date, status) {
  this.lastTested = date;
  if (this.isUp != status) {
    this.lastChanged = date;
    this.isUp = status;
    this.uptime = 0;
    this.downtime = 0;
  }
  var durationSinceLastChange = date - this.lastChanged;
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
  Ping.countForCheck(check, new Date() - (24 * 60 * 60 * 1000), new Date(), function(err, result) {
    if (err || !(0 in result)) return;
    check.qos = result[0].value;
    check.markModified('qos');
    check.save(callback);
  });
}

Check.statics.findByUptime = function(order, callback) {
  if (typeof order == 'undefined' || order == 'asc') {
    // return first checks that are down since a long time,
    // then the ones down since not that long,
    // then the ones up since not that long,
    // then the ones up since a long time
    // useful for monitoring
    this.find({}).desc('downtime').asc('uptime').run(callback);
  } else {
    // return first atrgets that are up since a long time
    // then the ones up since not that long
    // then the ones down since not that long
    // then the ones down since a long time
    // useful to see the most stable services
    this.find({}).desc('uptime').asc('downtime').run(callback);
  }
}

Check.statics.updateAllQos = function(callback) {
  this.find({}).each(function (err, check) {
    if(err || !check) return;
    check.updateQos(callback);
  });
}

Check.statics.countForGroups = function(callback) {
  var mapFunction = function() {
    var check = this;
    this.groups.forEach(function(group) {
      emit(group.name, { qos: check.qos } )
    });
  }
  var reduceFunction = function(key, values) {
    var result = { qos: { count: 0, ups: 0, responsives: 0 } };
    values.forEach(function(value) {
      result.qos.count       += value.qos.count;
      result.qos.ups         += value.qos.ups;
      result.qos.responsives += value.qos.responsives;
    });
    return result;
  }
  this.collection.mapReduce(
    mapFunction.toString(),
    reduceFunction.toString(),
    { out: { inline: 1 } },
    callback
  );
}

exports.Check = mongoose.model('Check', Check);
