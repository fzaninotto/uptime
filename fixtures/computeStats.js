var mongoose = require('mongoose'),
    config   = require('config').mongodb,
    async    = require('async');

// configure mongodb
mongoose.connect('mongodb://' + config.user + ':' + config.password + '@' + config.server +'/' + config.database);

// models dependencies
var Ping   = require('../models/ping');

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

async.series([updateHourlyQosSinceTheFirstPing, updateLastHourQos], function(err) {
  if (err) {
    console.dir(err);
  } else {
    console.log('Computing complete');
  }
  setTimeout(function() { mongoose.connection.close(); }, 1000);
});