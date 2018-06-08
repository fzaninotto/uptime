/**
 * Discord plugin
 * Notifies all events (up, down, paused, restarted) by discord
 *
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry
 * to the `plugins` key of the configuration:
 *
 *   // in config/default.yaml
 *   plugins:
 *     - ./plugins/discord
 *
 * Usage
 * -----
 * This plugin sends a discord each time a check is started, goes down, or goes back up.
 * When the check goes down, the discord contains the error details:
 *
 *   Object: [Down] Check "FooBar" just went down
 *   On Thursday, September 4th 1986 8:30 PM,
 *   a test on URL "http://foobar.com" failed with the following error:
 *
 *     Error 500
 * 
 * Activate Voice Message
 * -----
 * 
 * If you'd like to activate voice messages via Discord, please uncomment line 79,
 * tts: true
 *
 * Configuration
 * -------------
 * Here is an example configuration:
 *
 *   // in config/default.yaml
 *   discord:
 *     webhookURL: https://Idiscordapp.com/api/webhooks/020907810730016768/T8sgM5AvlUgp9Nuen3dDdtL6iTDm3Zza3cNCUvbnmYPc07lUDy55PYnu90goHRlxCcDD
 *     event:
 *       up:        true
 *       down:      true
 *       paused:    false
 *       restarted: false
 */
var moment = require('moment');
var CheckEvent = require('../../models/checkEvent');
var request = require('request');

exports.initWebApp = function (options) {
    // small message formatter
    function getMessageText(event, check) {
        switch (event.message) {
            case 'down':
                return 'On ' + moment(event.timestamp).format('LLLL') + ' a test on URL' + check.url + ' failed with the following error ' + event.details
            case 'paused':
                return 'On ' + moment(event.timestamp).format('LLLL') + ' ' + check.url + ' was manually paused'
            case 'restarted':
                return 'On ' + moment(event.timestamp).format('LLLL') + ' ' + check.url + ' was manually restarted'
            case 'up':
                if (event.downtime)
                    return 'Check ' + check.name + ' went back up. ' + 'On ' + moment(event.timestamp).format('LLLL') + ' and after ' + moment.duration(event.downtime).humanize() + ' of downtime.'
                else
                    return 'Check ' + check.name + ' is now up. ' + 'On ' + moment(event.timestamp).format('LLLL') + ' a test on URL ' + check.url + ' responded correctly.'
            default:
                return ''
        };

    };
    // get config
    var config = options.config.discord;
    CheckEvent.on('afterInsert', function (checkEvent) {
        if (!config.event[checkEvent.message]) return;
        checkEvent.findCheck(function (err, check) {
            if (err) return console.error(err);

            // get text message
            var text = getMessageText(checkEvent, check);
            // send message
            var discordOptions = {
                content: text,
                // tts: true
            }
            request.post({ url: config.webhookURL, form: discordOptions }, function (err, httpResponse, body) { console.log(err); })

        });
    });
    console.log('Enabled Discord notifications');
};