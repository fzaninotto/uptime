/**
 * Basic Authentication plugin
 *
 * Add HTTP Basic Access Authentication to the dashboard and API applications
 *
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry 
 * to the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     - ./plugins/basicAuth
 *
 * Usage
 * -----
 * Restart the application, and both the API and the Dashboard applications 
 * become protected. The monitor correctly authenticates its own calls to the API.
 * 
 * Default credentials are admin:password.
 *
 * Configuration
 * -------------
 * Set the username and password in the configuration file, under the
 * basicAuth key:
 *
 *   // in config/production.yaml
 *   basicAuth:
 *     username: JohnDoe
 *     password: S3cR3t
 */
var express = require('express');

exports.initWebApp = function(options) {
  var config = options.config.basicAuth;
  options.app.on('beforeFirstRoute', function(app, dashboardApp) {
    app.use(express.basicAuth(config.username, config.password));
  });
};

exports.initMonitor = function(options) {
  var config = options.config.basicAuth;
  options.monitor.addApiHttpOption('auth',  config.username + ':' + config.password);
};