/**
 * StatusPage plugin
 *
 * Create an autonomous status page
 *
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry
 * to the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     - ./plugins/statusPage
 *
 * Usage
 * -----
 * This plugin generate an html file each time a check is started, goes down, or goes back up.
 *
 * Configuration
 * -------------
 * Here is an example configuration:
 *
 *   // in config/production.yaml
 *   statusPage:
 *     exec:          (scp $1 user@server:/var/www/status/index.html) # command executed after every changes
 *     basePath:      '/'    # base path for assets
 *     event:
 *         up:        true
 *         down:      true
 *         paused:    false
 *         restarted: false
 */
var fs         = require('fs');
var moment     = require('moment');
var CheckEvent = require('../../models/checkEvent');
var Check      = require('../../models/check');
var ejs        = require('ejs');
var exec       = require('child_process').exec;
var moduleInfo = require('../../package.json');
var path       = require('path');

exports.initWebApp = function(options) {
  var config = options.config.statusPage || {};
  var templateDir = __dirname + '/views/';
  var filename = templateDir + 'status.ejs';
  CheckEvent.on('afterInsert', function(checkEvent) {
    if (!config.event[checkEvent.message]) return;
    CheckEvent
    .find({ timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
    .sort({ timestamp: -1 })
    .select({ tags: 0 })
    .limit(100)
    .exec(function(err, events) {
      if (err) {
        console.error(err);
        return;
      }
      CheckEvent.aggregateEventsByDay(events, function (err, days) {
        if (err) {
          console.error(err);
          return;
        }
        var count = { up: 0, down: 0, paused: 0, total: 0 };
        Check.find().sort({ isUp: 1, lastChanged: -1 }).exec(function(err, checks) {
          if (err) return callback(err);
          checks.forEach(function(check) {
            count.total++;
            if (check.isPaused) {
              count.paused++;
            } else if (check.isUp) {
              count.up++;
            } else {
              count.down++;
            }
          });
          var renderOptions = {
            days: days,
            checks: checks,
            count: count,
            filename: filename,
            version: moduleInfo.version,
            moment: moment,
            route: config.basePath ? config.basePath : '/'
          };
          var html = ejs.render(fs.readFileSync(filename, 'utf8'), renderOptions);
          fs.writeFileSync('status.html', html);
          if (config.exec.length > 0) {
            var cmd = config.exec.replace('$1', 'status.html');
            console.log('exec : [%s]', cmd);
            try {
              var child = exec(cmd, {detached: true, stdio: 'ignore'});
              child.on('error', function (error) {
                console.error(error);
              });
              child.unref();
            }
            catch (err) {
              console.error(err);
            }
          }
        });
      });
    });
  });
  console.log('Enabled static status page generation.');
};
