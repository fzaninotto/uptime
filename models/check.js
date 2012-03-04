var mongoose = require('mongoose'),
    Schema   = mongoose.Schema,
    TimeCalculator = require('../lib/timeCalculator'),
    async    = require('async');

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

Check.pre('remove', function(next) {
  this.removePings(function() {
    next();
  });
});

Check.pre('remove', function(next) {
  this.removeStats(function() {
    next();
  });
});

Check.methods.removePings = function(callback) {
  Ping.find({ check: this._id }).remove(callback);
};

Check.methods.removeStats = function(callback) {
  var self = this;
  async.parallel([
    function(cb) { require('../models/checkHourlyStat').find({ check: self._id }).remove(cb); },
    function(cb) { require('../models/checkDailyStat').find({ check: self._id }).remove(cb); },
    function(cb) { require('../models/checkMonthlyStat').find({ check: self._id }).remove(cb); }
  ], callback);
};

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

var qosParams = {
  '6h':  { type: 'Ping',             fromDate: new Date(Date.now() -                 6 * 60 * 60 * 1000) },
  '1d':  { type: 'CheckHourlyStat',  fromDate: new Date(Date.now() -                25 * 60 * 60 * 1000) },
  '7d':  { type: 'CheckHourlyStat',  fromDate: new Date(Date.now() -            8 * 24 * 60 * 60 * 1000) },
  'MTD': { type: 'CheckDailyStat',   fromDate: TimeCalculator.resetMonth(new Date()) },
  '1m':  { type: 'CheckDailyStat',   fromDate: new Date(Date.now() -           31 * 24 * 60 * 60 * 1000) },
  '3m':  { type: 'CheckDailyStat',   fromDate: new Date(Date.now() -       3 * 31 * 24 * 60 * 60 * 1000) },
  '6m':  { type: 'CheckMonthlyStat', fromDate: new Date(Date.now() -       6 * 31 * 24 * 60 * 60 * 1000) },
  'YTD': { type: 'CheckMonthlyStat', fromDate: TimeCalculator.resetYear(new Date()) },
  '1y':  { type: 'CheckMonthlyStat', fromDate: new Date(Date.now() -      12 * 31 * 24 * 60 * 60 * 1000) },
  'max': { type: 'CheckMonthlyStat', fromDate: new Date(Date.now() - 10 * 12 * 31 * 24 * 60 * 60 * 1000) },
};

Check.methods.getUptimeForPeriod = function(period, callback) {
  var qosParam = qosParams[period];
  var uptimes = [];
  var uptimeScore;
  this.db.model(qosParam.type).find({ check: this, timestamp: { $gte: qosParam.fromDate } }).asc('timestamp').each(function(err, stat) {
    if (stat) {
      if (stat.isUp) {
        // stat is a Ping
        uptimeScore = stat.isUp ? 100 : 0; 
      } else {
        // stat is an aggregation
        uptimeScore = (stat.ups / stat.count).toFixed(5) * 100;
      };
      uptimes.push([Date.parse(stat.timestamp), uptimeScore]);
    } else {
      callback(uptimes);
    }
  });
}

Check.methods.getResponseTimeForPeriod = function(period, callback) {
  var qosParam = qosParams[period];
  var responseTimes = [];
  var responseTimeScore;
  this.db.model(qosParam.type).find({ check: this, timestamp: { $gte: qosParam.fromDate } }).asc('timestamp').each(function(err, stat) {
    if (stat) {
      if (stat.isUp) {
        // stat is a Ping
        responseTimeScore = stat.time; 
      } else {
        // stat is an aggregation
        responseTimeScore = Math.round(stat.time / stat.count);
      };
      responseTimes.push([Date.parse(stat.timestamp), responseTimeScore]);
    } else {
      callback(responseTimes);
    }
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


Check.statics.convertTags = function(tags) {
  if (typeof(tags) === 'string') {
    tags = tags.replace(/\s*,\s*/g, ',').split(',');
  }
  return tags;
}

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
    return !this.lastTested || (Date.now() - this.lastTested.getTime()) > (this.interval || 60000);
  }).each(callback);
}

Check.statics.updateAllQos = function(callback) {
  this.find({}).each(function (err, check) {
    if(err || !check) return;
    check.updateQos(callback);
  });
}

module.exports = mongoose.model('Check', Check);
