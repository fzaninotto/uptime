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
 

var boxcar = require('boxcar');
var moment     = require('moment');
var config     = require('config').boxcar;
var CheckEvent = require('../../models/checkEvent');

 
exports.init = function() {

  	CheckEvent.on('afterInsert', function(checkEvent) {
    	if (!config.event[checkEvent.message]) return;
    	
    	checkEvent.findCheck(function(err, check) {

      		if (err) return console.error(err);

      		var text = check.name + ' has been ' + checkEvent.message;
      		//+ 'failed with this error : '+checkEvent.details
      		
      		console.log("boxcar : " + text);
      		console.log(config.email + ',' + config.password);
      		
      		var boxcar = require('boxcar');
			var provider = new boxcar.Provider(config.key, config.secret);
			
			
			//send a message to a user directly
			provider.notify(config.email, text);

    	});
  	});
  	console.log('Enabled boxcar plugin');
};