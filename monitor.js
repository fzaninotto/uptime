var config     = require('config'),
    monitor    = require('./lib/monitor');

// start the monitor
m = monitor.createMonitor(config.monitor);
m.start();
