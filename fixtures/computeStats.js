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
  while (date < now) {
    dateObject = new Date(date);
    Ping.updateHourlyQos(new Date(date));
    nbDates++;
    if (nbDates % 24 == 0) {
      console.log('Asking for stats for ' + new Date(date).toUTCString());
    }
    date += 60 * 60 * 1000;
  }
  console.log('Waiting for computation to finish...');
  setTimeout(function() { 
    mongoose.connection.close();
  }, 1000)
})