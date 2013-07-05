var fs      = require('fs');
var config  = require('config');
var Monitor = require('./lib/monitor');

// start the monitor
monitor = Monitor.createMonitor(config.monitor);

// load plugins
fs.exists('./plugins/index.js', function(exists) {
  if (exists) {
    var pluginIndex = require('./plugins');
    if (typeof pluginIndex.initMonitor === 'function') {
      pluginIndex.initMonitor({
        monitor: monitor,
        config:  config
      });
    }
  }
});

monitor.start();

module.exports = monitor;