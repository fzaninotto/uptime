var config     = require('config');
var monitor    = require('./lib/monitor');

// start the monitor
m = monitor.createMonitor(config.monitor);
m.start();
