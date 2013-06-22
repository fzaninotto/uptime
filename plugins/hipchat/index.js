/**
 * HipChat plugin
 *
 * Notifies all events (up, down, paused, restarted) using HipChat
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./hipchat').init();
 *   }
 *
 * Example configuration
 * hipchat:
 *   token: 0280**************************
 *   room_id: 20****
 *   from: 'Uptime robot'
 *   event:
 *     up:        true
 *     down:      true
 *     paused:    false
 *     restarted: false 
 */
var fs         = require('fs');
var moment     = require('moment');
var config     = require('config').hipchat;
var CheckEvent = require('../../models/checkEvent');
var ejs        = require('ejs');
var HipChatClient = require('node-hipchat');
 
exports.init = function() {
	var client =  new HipChatClient(config.token); // Initialize a new HipChatClient with the HipChat Token defined in the yaml file
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

      console.log('Notified event by HipChat: Check ' + check.name + ' ' + checkEvent.message);

			var hipchatMessageParams = {
				room: config.room_id,
				from: config.from,
				message: lines
			};

			// Send a HipChat message
			client.postMessage(hipchatMessageParams, function(err1, responseData) { //this function is executed when a response is received from HipChat
          if (!err1) { // "err" is an error received during the request, if any
              console.log(responseData.body);
          }
      }); 
    });
  });
  console.log('Enabled HipChat notifications');
};