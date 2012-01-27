var mongoose = require('mongoose'),
    config   = require('../config/config.js');

// configure mongodb
mongoose.connect('mongodb://' + config.mongodbUser + ':' + config.mongodbPassword + '@' + config.mongodbServer +'/' + config.mongodbDatabase);

// models dependencies
var Ping   = require('../models/ping');

Ping.updateLastHourQos.apply(Ping);
Ping.find().asc('date').findOne(function(err, ping) {
  var date = ping.date.valueOf();
  var now = Date.now();
  nbDates = 0;
  updateNextHourlyQos(date, now, nbDates);
  console.log('Waiting for computation to finish...');
});

var updateNextHourlyQos = function(date, now, nbDates) {
  dateObject = new Date(date);
  Ping.updateHourlyQos(dateObject, function(isLast) { return function(err) {
    if (isLast) setTimeout(function() { mongoose.connection.close(); }, 1000);
  }}((date + 60 * 60 * 1000) >= now));
  nbDates++;
  if (nbDates % 24 == 0) {
    console.log('Asking for stats for ' + dateObject.toUTCString());
  }
  date += 60 * 60 * 1000;
  if (date < now) {
    process.nextTick(function() { updateNextHourlyQos(date, now, nbDates); });
  }

}
