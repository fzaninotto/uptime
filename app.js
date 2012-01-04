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
var Target = require('./models/target').Target;
Target.updateAllQos();
