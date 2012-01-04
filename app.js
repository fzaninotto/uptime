/*
 * Monitor remote server uptime.
 */

var mongoose = require('mongoose'),
    monitor  = require('./lib/monitor');

// models
var Target = require('./models/target').Target,
    Ping   = require('./models/ping').Ping;

// configure mongodb
var mongodbUser = 'root';
var mongodbPassword = '';
var mongodbServer = 'localhost';
var mongodbDatabase = 'uptime';
mongoose.connect('mongodb://' + mongodbUser + ':' + mongodbPassword + '@' + mongodbServer +'/' + mongodbDatabase);

// clear database
Target.remove({}, function (err) {
  if (err) console.dir(err);
});

// add two targets
t = new Target();
t.url = 'http://www.google.com/index.html';
t.timeout = 200;
t.save(function (err) {
  if (err) console.dir(err);
});
t = new Target();
t.url = 'http://www.yahoo.com/';
t.timeout = 1300;
t.save(function (err) {
  if (err) console.dir(err);
});

// poll targets
m = monitor.createMonitor(2000);
m.start();


