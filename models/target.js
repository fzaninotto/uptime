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
  , timeout     : Number
  , groups      : [GroupMembership]
  , lastChanged : Date
  , lastTested  : Date
  , lastStatus  : Boolean
  , uptime      : { type: Number, default: 0 }
  , downtime    : { type: Number, default: 0 }
  , qos         : {}
});

Target.methods.setLastTest = function(date, status) {
  this.lastTested = date;
  if (this.lastStatus != status) {
    this.lastChanged = date;
    this.lastStatus = status;
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

Target.methods.isUp = function() {
  return this.lastStatus == true;
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

Target.statics.findUpByUptime = function(callback) {
  this.where('lastStatus', true).asc('uptime').run(callback);
}

Target.statics.findDownByDowntime = function(callback) {
  this.where('lastStatus', false).desc('downtime').run(callback);
}

Target.statics.updateAllQos = function(callback) {
  this.find({}, function (err, targets) {
    targets.forEach(function(target) { target.updateQos(callback); });
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
    var result = { qos: { count: 0, ups: 0 } };
    values.forEach(function(value) {
      result.qos.count += value.qos.count;
      result.qos.ups   += value.qos.ups;
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