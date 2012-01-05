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

// poll targets every 2 seconds and update the QoS score every 5 seconds
m = monitor.createMonitor(2000, 5000);
m.start();

