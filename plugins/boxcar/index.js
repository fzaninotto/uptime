/**
 * Boxcar plugin
 *
 * Notifies all events (up, down, paused, restarted) using boxcar app (available at boxcar.io)
 * Boxcar is a free ad supported app providing a hub for notifications from different services.
 *
 * To use this plugin:
 * 1/ register at boxcar.io
 * 2/ add boxcar configuration options to your yaml config file:
 *      * use your boxcar registered email in the email field
 *      * you can keep the provided key
 *      * you don't need any secret since it's a generic provider (broadcast is not allowed, see boxcar api documentation : http://boxcar.io/help/api/providers)
 * 4/ Download boxcar iOS app and login with your account
 * The plugin will automatically register your account to push notifications provided by the "uptime provider".
 *
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./boxcar').init();
 *   }
 *
 * Example configuration
 * boxcar:
 *   email:                   'your_registered_boxcar_email@mail.com'
 *   key: 'AagXreNW1r8Ib9HQHMnO'
 *   secret: 'your secret'
 *   event:
 *     up:        true
 *     down:      true
 *     paused:    false
 *     restarted: false
 */
 

var moment     = require('moment');
var config     = require('config').boxcar;
var CheckEvent = require('../../models/checkEvent');

var Boxcar = require('node-boxcar');
var provider = new Boxcar.provider(config.key, config.secret);


exports.init = function() {

    provider.subscribe({
        'email': config.email
    }, function(err, info) {
        if (err) {
            return console.error("The email might be already registered: " + err);
        }
        console.info(info);
    });


  	CheckEvent.on('afterInsert', function(checkEvent) {
    	if (!config.event[checkEvent.message]) return;
    	
    	checkEvent.findCheck(function(err, check) {

      		if (err) return console.error(err);

            var text = "";

            switch(checkEvent.message)
            {
                case "up":
                    if(checkEvent.downtime !== undefined)
                        text = check.name + ' went back up after ' + moment.duration(checkEvent.downtime).humanize() + ' of downtime';
                    else
                        text = check.name + ' went back up on ' + moment(checkEvent.timestamp).format('LLLL');
                    break;
                case "down":
                    text = check.name + ' just went down on ' + moment(checkEvent.timestamp).format('LLLL');
                    break;
                default:
                    text = check.name + ' has been ' + checkEvent.message + ' on ' +moment(checkEvent.timestamp).format('LLLL');
            };

            provider.notify({
                'email': config.email,
                'message': text,
                'from_screen_name': check.name,
                'source_url': config.dashboardUrl
            }, function(err, info) {
                if (err) {
                    return console.error(err);
                }
                console.info(info);
            });

    	});
  	});
  	console.log('Enabled boxcar plugin ');
};