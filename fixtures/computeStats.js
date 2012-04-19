var mongoose        = require('mongoose');
var config          = require('config').mongodb;
var async           = require('async');
var Ping            = require('../models/ping');
var Check           = require('../models/check');
var CheckHourlyStat = require('../models/checkHourlyStat');
var TagHourlyStat   = require('../models/tagHourlyStat');

// configure mongodb
mongoose.connect('mongodb://' + config.user + ':' + config.password + '@' + config.server +'/' + config.database);
mongoose.connection.on('error', function (err) {
  console.error('MongoDB error: ' + err.message);
  console.error('Make sure a mongoDB server is running and accessible by this application')
});

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
    function(cb) { Ping.updateLast24HoursQos(cb); },
    function(cb) { Ping.updateLastHourQos(cb); }
  ], callback);
}

var updateHourlyQosSinceTheFirstPing = function(callback) {
  Ping.find().asc('timestamp').findOne(function(err, ping) {
    var date = ping.timestamp.valueOf();
    var now = Date.now();
    nbDates = 0;
    async.whilst(
      function() { date += 60 * 60 * 1000; return date < now; },
      function(cb) {
        var dateObject = new Date(date);
        Ping.updateHourlyQos(dateObject, cb);
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
  Ping.find().asc('timestamp').findOne(function(err, ping) {
    var date = ping.timestamp.valueOf();
    var now = Date.now();
    nbDates = 0;
    async.whilst(
      function() { date += 24 * 60 * 60 * 1000; return date < now; },
      function(cb) {
        var dateObject = new Date(date);
        async.parallel([
          function(callme) { CheckHourlyStat.updateDailyQos(dateObject, callme); },
          function(callme) { TagHourlyStat.updateDailyQos(dateObject, callme); },
        ], cb);
        nbDates++;
        console.log('Computing daily stats for ' + dateObject.toUTCString());
      },
      callback
    );
  });
}

var updateMonthlyQosSinceTheFirstPing = function(callback) {
  Ping.find().asc('timestamp').findOne(function(err, ping) {
    var date = ping.timestamp.valueOf();
    var now = Date.now();
    nbDates = 0;
    async.whilst(
      function() { date += 28 * 24 * 60 * 60 * 1000; return date < now; },
      function(cb) {
        var dateObject = new Date(date);
        async.parallel([
          function(callme) { CheckHourlyStat.updateMonthlyQos(dateObject, callme); },
          function(callme) { TagHourlyStat.updateMonthlyQos(dateObject, callme); },
        ], cb);
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