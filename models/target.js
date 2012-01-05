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
var Target = new Schema({
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

Target.methods.setLastTest = function(date, status) {
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

Target.methods.getQosPercentage = function() {
  if (!this.qos) return false;
  return (this.qos.ups / this.qos.count) * 100;
}

Target.methods.updateQos = function(callback) {
  var target = this;
  Ping.countForTarget(target, new Date() - (24 * 60 * 60 * 1000), new Date(), function(err, result) {
    if (err || !(0 in result)) return;
    target.qos = result[0].value;
    target.markModified('qos');
    target.save(callback);
  });
}

Target.statics.findByUptime = function(order, callback) {
  if (typeof order == 'undefined' || order == 'asc') {
    // return first targets that are down since a long time,
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

Target.statics.updateAllQos = function(callback) {
  this.find({}).each(function (err, target) {
    if(err || !target) return;
    target.updateQos(callback);
  });
}

Target.statics.countForGroups = function(callback) {
  var mapFunction = function() {
    var target = this;
    this.groups.forEach(function(group) {
      emit(group.name, { qos: target.qos } )
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

exports.Target = mongoose.model('Target', Target);
