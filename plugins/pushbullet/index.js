/**
 * PushBullet plugin
 *
 * Notifies all events (up, down, paused, restarted) using PushBullet (https://www.pushbullet.com/)
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./pushbullet').init();
 *   }
 *
 * Example configuration
 * pushbullet:
 * api_key: dd******************************
 * device_id: *****
 *   event:
 *     up:        true
 *     down:      true
 *     paused:    false
 *     restarted: false 
 */
var fs         = require('fs');
var moment     = require('moment');
var config     = require('config').pushbullet;
var CheckEvent = require('../../models/checkEvent');
var ejs        = require('ejs');
var PushBullet = require('pushbullet');
 
exports.init = function() {
	var client =  new PushBullet(config.api_key); // Initialize a new PushBullet instance with the PushBullet API key defined in the yaml file
  var templateDir = __dirname + '/views/';
  CheckEvent.on('afterInsert', function(checkEvent) {
    if (!config.event[checkEvent.message]) return;
    checkEvent.findCheck(function(err, check) {
      if (err) return console.error(err);
      var filename = templateDir + checkEvent.message + '.ejs';
      var renderOptions = { 
        check: check, 
        checkEvent: checkEvent, 
        url: config.dashboardUrl, 
        moment: moment, 
        filename: filename
      };
      var lines = ejs.render(fs.readFileSync(filename, 'utf8'), renderOptions);

      console.log('Notified event by PushBullet: Check ' + check.name + ' ' + checkEvent.message);

			// Send a PushBullet message
			client.note(config.device_id, 'Uptime alert', lines, function(err1, responseData) { //this function is executed when a response is received from HipChat
          if (!err1) { // "err" is an error received during the request, if any
              console.log(responseData);
          }
      }); 
    });
  });
  console.log('Enabled PushBullet notifications');
};