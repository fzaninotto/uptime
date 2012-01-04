/*
 * Monitor remote server uptime.
 */

var mongoose = require('mongoose'),
    monitor  = require('./lib/monitor');

// configure mongodb
var mongodbUser = 'root';
var mongodbPassword = '';
var mongodbServer = 'localhost';
var mongodbDatabase = 'uptime';
mongoose.connect('mongodb://' + mongodbUser + ':' + mongodbPassword + '@' + mongodbServer +'/' + mongodbDatabase);

// poll targets
m = monitor.createMonitor(2000);
m.start();

// test reduce
var Ping = require('./models/ping').Ping;
var Target = require('./models/target').Target;
Target.find({}, function (err, targets) {
  targets.forEach(function(target) {
    Ping.countForTarget(target, function(err, result) {
      console.dir(result);
    });
  });
});
