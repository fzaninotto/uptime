/**
 * Webhooks plugin
 *
 * Notifies all events (up, down, paused, restarted) by sending a
 * HTTP POST request to the given URL. The request will have a
 * JSON payload of data from the event
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./webhooks').init();
 *   }
 *
 * Example configuration
 *   webhooks:
 *     event:
 *       up:
 *         - 'http://localhost:8082'
 *         - 'http://www.example.com/do/something'
 *       down:
 *         - 'http://www.example.com/warn/somebody'
 *       paused:
 *       restarted:
 *     dashboardUrl: 'http://localhost:8082'
 */

var http       = require('http');
var url        = require('url');
var util       = require('util');
var config     = require('config');
var CheckEvent = require('../../models/checkEvent');

exports.init = function() {
  CheckEvent.on('afterInsert', function(checkEvent) {
    var webhooks = config.webhooks;
    var hrefs = webhooks.event[checkEvent.message];

    if (!util.isArray(hrefs)) return;
    checkEvent.findCheck(function(err, check) {
        var payload = {};
        if (err) return console.error(err);

        payload.name      = check.name;
        payload.url       = check.url;
        payload.details   = checkEvent.details;
        payload.message   = checkEvent.message;
        payload.dashboard = webhooks.dashboardUrl + '/dashboard/checks/' + check._id + '?type=hour&date=' + checkEvent.timestamp.valueOf();
        payload.tags      = check.tags;
        payload.timestamp = checkEvent.timestamp;

        hrefs.forEach(function(href) {
            var options = url.parse(href);
            options.method = 'POST';
            options.headers = {
                'Content-Type' : 'application/json'
            };

            var req = http.request(options, function(res) {

            });

            req.on('error', function(e) {
              console.log('Problem with webhook request: ' + e.message);
            });

            req.write(JSON.stringify(payload));
            req.end();
        });

    });
  });
  console.log('Enabled webhooks plugin');
};
