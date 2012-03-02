var mongoose = require('mongoose'),
    config   = require('config').mongodb,
    async    = require('async');

// configure mongodb
mongoose.connect('mongodb://' + config.user + ':' + config.password + '@' + config.server +'/' + config.database);

// models dependencies
var Ping            = require('../models/ping');
var CheckHourlyStat = require('../models/checkHourlyStat');

var updateLastHourQos = function(callback) {
  console.log('Updating last hour Qos for all checks');
  Ping.updateLastHourQos(callback);
}

var updateHourlyQosSinceTheFirstPing = function(callback) {
  Ping.find().asc('date').findOne(function(err, ping) {
    var date = ping.date.valueOf();
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
  Ping.find().asc('date').findOne(function(err, ping) {
    var date = ping.date.valueOf();
    var now = Date.now();
    nbDates = 0;
    async.whilst(
      function() { date += 24 * 60 * 60 * 1000; return date < now; },
      function(cb) {
        var dateObject = new Date(date);
        CheckHourlyStat.updateDailyQos(dateObject, cb);
        nbDates++;
        console.log('Computing daily stats for ' + dateObject.toUTCString());
      },
      callback
    );
  });
}

var updateMonthlyQosSinceTheFirstPing = function(callback) {
  Ping.find().asc('date').findOne(function(err, ping) {
    var date = ping.date.valueOf();
    var now = Date.now();
    nbDates = 0;
    async.whilst(
      function() { date += 28 * 24 * 60 * 60 * 1000; return date < now; },
      function(cb) {
        var dateObject = new Date(date);
        CheckHourlyStat.updateMonthlyQos(dateObject, cb);
        nbDates++;
        console.log('Computing monthly stats for ' + dateObject.toUTCString());
      },
      callback
    );
  });
}

async.series([updateLastHourQos, updateHourlyQosSinceTheFirstPing, updateDailyQosSinceTheFirstPing, updateMonthlyQosSinceTheFirstPing], function(err) {
  if (err) {
    console.dir(err);
  } else {
    console.log('Computing complete');
  }
  setTimeout(function() { mongoose.connection.close(); }, 1000);
});