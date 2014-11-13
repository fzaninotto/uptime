/**
 * Pagerduty plugin
 *
 * Notifies all events (up, down, paused, restarted) by pagerduty
 *
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry 
 * to the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     - ./plugins/pagerduty
 *
 * Usage
 * -----
 * This plugin sends an alert to pagerduty each time a check is started, goes down, or goes back up. 
 * When the check goes down, the alert contains the error details.
 *
 *
 * Configuration
 * -------------
 * Here is an example configuration:
 *
 *   // in config/production.yaml
 *   pagerduty:
 *      serviceKey: 2d2157f0geee5e56b1413ec379144fc9
 *      up:        true
 *      down:      true
 *      paused:    false
 *      restarted: false 
 *
 *  # The pagerduty plugin also uses the main `url` param for hyperlinks in the sent alerts
 */
var moment     = require('moment');
var CheckEvent = require('../../models/checkEvent');
var PagerDuty  = require('pagerduty');


exports.initWebApp = function(options) {
  var config = options.config.pagerduty;
  var templateDir = __dirname + '/views/';

  var pager = new PagerDuty({
    serviceKey: config.serviceKey 
  });

  CheckEvent.on('afterInsert', function(checkEvent) {
    if (!config.event[checkEvent.message]) return;
    checkEvent.findCheck(function(err, check) {
      if (err) return console.error(err);

      // Pager Duty Direct Start
      pager.create({
        description: "Check " + check.name + " status changed to " + checkEvent.message , // required
        details: {
          details: checkEvent.details,
          timestamp: moment(checkEvent.timestamp).format('LLLL'),
          url: options.config.url + "/dashboard/checks/" + check._id + "?type=hour&date=" + checkEvent.timestamp.valueOf()
        },
        callback: function(err, response) {
          if (err) return console.error('PagerDuty plugin error: %s', err);
          console.log('Notified Pagerduty API of error : Check ' + check.name + ' ' + checkEvent.message);
        }
      });
    });
  });
  console.log('Enabled Pagerduty notifications');
};
