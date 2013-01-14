var async           = require('async');
var mongoose        = require('../bootstrap');
var Ping            = require('../models/ping');
var Check           = require('../models/check');
var CheckHourlyStat = require('../models/checkHourlyStat');
var Tag             = require('../models/tag');
var TagHourlyStat   = require('../models/tagHourlyStat');
var QosAggregator   = require('../lib/qosAggregator');

var emptyStats = function(callback) {
  console.log('Emptying stat collections');
  Check.find({}, function(err, checks) {
    if (!checks.length) return callback(new Error('No check in database, please use the populate script first'));
    async.forEach(checks, function(check, cb) { check.removeStats(cb); }, callback);
  });
};

var updateUptime = function(callback) {
  console.log('Updating uptime');
  Check.find({}, function(err, checks) {
    async.forEach(checks, function(check, cb) { check.updateUptime(cb); }, callback);
  });
};

var updateHourlyQosSinceTheFirstPing = function(callback) {
  Ping
  .find()
  .sort({ 'timestamp': 1 })
  .findOne(function(err, ping) {
    var date = Date.now() + 60 * 60 * 1000;
    var oldestDate = ping.timestamp.valueOf();
    var nbDates = 0;
    async.whilst(
      function() { date -= 60 * 60 * 1000; return date > oldestDate; },
      function(cb) {
        var dateObject = new Date(date);
        QosAggregator.updateHourlyQos(dateObject, cb);
        if (nbDates % 24 == 0) {
          console.log('Computing hourly stats for ' + dateObject.toUTCString());
        }
        nbDates++;
      },
      callback
    );
  });
};

var updateDailyQosSinceTheFirstPing = function(callback) {
  Ping
  .find()
  .sort({ 'timestamp': 1 })
  .findOne(function(err, ping) {
    var date = Date.now() + 24 * 60 * 60 * 1000;
    var oldestDate = ping.timestamp.valueOf();
    async.whilst(
      function() { date -= 24 * 60 * 60 * 1000; return date > oldestDate; },
      function(cb) {
        var dateObject = new Date(date);
        QosAggregator.updateDailyQos(dateObject, cb);
        console.log('Computing daily stats for ' + dateObject.toUTCString());
      },
      callback
    );
  });
};

var updateMonthlyQosSinceTheFirstPing = function(callback) {
  Ping
  .find()
  .sort({ 'timestamp': 1 })
  .findOne(function(err, ping) {
    var date = Date.now() + 28 * 24 * 60 * 60 * 1000;
    var oldestDate = ping.timestamp.valueOf();
    var nbDates = 0;
    async.whilst(
      function() { date -= 28 * 24 * 60 * 60 * 1000; return date > oldestDate; },
      function(cb) {
        var dateObject = new Date(date);
        QosAggregator.updateMonthlyQos(dateObject, cb);
        nbDates++;
        console.log('Computing monthly stats for ' + dateObject.toUTCString());
      },
      callback
    );
  });
};

var updateYearlyQosSinceTheFirstPing = function(callback) {
  Ping
  .find()
  .sort({ 'timestamp': 1 })
  .findOne(function(err, ping) {
    var date = Date.now() + 365 * 24 * 60 * 60 * 1000;
    var oldestDate = ping.timestamp.valueOf();
    var nbDates = 0;
    async.whilst(
      function() { date -= 365 * 24 * 60 * 60 * 1000; return date > oldestDate; },
      function(cb) {
        var dateObject = new Date(date);
        QosAggregator.updateYearlyQos(dateObject, cb);
        nbDates++;
        console.log('Computing yearly stats for ' + dateObject.getFullYear());
      },
      callback
    );
  });
};

var updateLastDayQos = function(callback) {
  console.log('Updating last day Qos for all checks');
  QosAggregator.updateLast24HoursQos(callback);
};

var ensureTagsHaveFirstTestedDate = function(callback) {
  console.log('Updating tags for firstTested date');
  Tag.ensureTagsHaveFirstTestedDate(callback);
};

async.series([emptyStats, updateUptime, updateHourlyQosSinceTheFirstPing, updateDailyQosSinceTheFirstPing, updateMonthlyQosSinceTheFirstPing, updateYearlyQosSinceTheFirstPing, updateLastDayQos, ensureTagsHaveFirstTestedDate], function(err) {
  if (err) {
    throw err;
  } else {
    console.log('Computing complete');
  }
  setTimeout(function() { mongoose.connection.close(); }, 1000);
});