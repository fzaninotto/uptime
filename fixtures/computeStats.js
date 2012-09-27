var async           = require('async');
var mongoose        = require('../bootstrap');
var Ping            = require('../models/ping');
var Check           = require('../models/check');
var CheckHourlyStat = require('../models/checkHourlyStat');
var TagHourlyStat   = require('../models/tagHourlyStat');
var QosAggregator   = require('../lib/qosAggregator');

var emptyStats = function(callback) {
  console.log('Emptying stat collections');
  Check.find({}, function(err, checks) {
    async.forEach(checks, function(check, cb) { check.removeStats(cb); }, callback);
  });
}

var updateUptime = function(callback) {
  console.log('Updating uptime');
  Check.find({}, function(err, checks) {
    async.forEach(checks, function(check, cb) { check.updateUptime(cb); }, callback);
  });
}

var updateLastHourQos = function(callback) {
  console.log('Updating last hour Qos for all checks');
  async.series([
    function(cb) { QosAggregator.updateLast24HoursQos(cb); },
    function(cb) { QosAggregator.updateLastHourQos(cb); }
  ], callback);
}

var updateHourlyQosSinceTheFirstPing = function(callback) {
  Ping
  .find()
  .sort({ 'timestamp': 1 })
  .findOne(function(err, ping) {
    var date = ping.timestamp.valueOf();
    var now = Date.now();
    nbDates = 0;
    async.whilst(
      function() { date += 60 * 60 * 1000; return date < now; },
      function(cb) {
        var dateObject = new Date(date);
        QosAggregator.updateHourlyQos(dateObject, cb);
        nbDates++;
        if (nbDates % 24 == 0) {
          console.log('Computing hourly stats for ' + dateObject.toUTCString());
        }
      },
      callback
    );
  });
}

var updateDailyQosSinceTheFirstPing = function(callback) {
  Ping
  .find()
  .sort({ 'timestamp': 1 })
  .findOne(function(err, ping) {
    var date = ping.timestamp.valueOf();
    var now = Date.now();
    nbDates = 0;
    async.whilst(
      function() { date += 24 * 60 * 60 * 1000; return date < now; },
      function(cb) {
        var dateObject = new Date(date);
        QosAggregator.updateDailyQos(dateObject, cb);
        nbDates++;
        console.log('Computing daily stats for ' + dateObject.toUTCString());
      },
      callback
    );
  });
}

var updateMonthlyQosSinceTheFirstPing = function(callback) {
  Ping
  .find()
  .sort({ 'timestamp': 1 })
  .findOne(function(err, ping) {
    var date = ping.timestamp.valueOf();
    var now = Date.now();
    nbDates = 0;
    async.whilst(
      function() { date += 28 * 24 * 60 * 60 * 1000; return date < now; },
      function(cb) {
        var dateObject = new Date(date);
        QosAggregator.updateMonthlyQos(dateObject, cb);
        nbDates++;
        console.log('Computing monthly stats for ' + dateObject.toUTCString());
      },
      callback
    );
  });
}

async.series([emptyStats, updateUptime, updateLastHourQos, updateHourlyQosSinceTheFirstPing, updateDailyQosSinceTheFirstPing, updateMonthlyQosSinceTheFirstPing], function(err) {
  if (err) {
    console.dir(err);
  } else {
    console.log('Computing complete');
  }
  setTimeout(function() { mongoose.connection.close(); }, 1000);
});