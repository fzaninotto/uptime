/**
 * Prowl plugin
 *
 * Notifies all events (up, down, paused, restarted) by email
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./prowl').init();
 *   }
 *
 * Example configuration
 *   prowl:
 *     key:         36e605fd9717f5b28967ca546593bbe84abb63b1   
 *     event:
 *       up:        true
 *       down:      true
 *       paused:    false
 *       restarted: false
 *     dashboardUrl: 'http://localhost:8082'
 */
 

var Prowl = require('prowler');
var moment     = require('moment');
var config     = require('config').prowl;
var CheckEvent = require('../../models/checkEvent');

var prowl = new Prowl.connection(config.key);

exports.init = function() {

  	CheckEvent.on('afterInsert', function(checkEvent) {
    	if (!config.event[checkEvent.message]) return;
    	
    	checkEvent.findCheck(function(err, check) {

      		if (err) return console.error(err);

      		//var text = check.name+' check failed with this error : '+checkEvent.details;
            var text = check.name + ' has been ' + checkEvent.message;

      		var prowlOptions = {
                  'application': check.name,
                  'event': checkEvent.message,
                  'description': text,
                  'priority': 0
              };

      		prowl.send( prowlOptions, function(err, info) {
                  if (err) {
                      return console.error(err);
                  }
                  console.log(info);
            });
    	});
  	});
  	console.log('Enabled prowl plugin');
};