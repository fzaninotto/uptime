/**
 * Email plugin
 *
 * Notifies all events (up, down, paused, restarted) by SMS using Twilio
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./twilio').init();
 *   }
 *
 * Example configuration
 * twilio:
 *   account_sid: AC81******************************
 *   auth_token:  675*********************************
 *   event:
 *     up:        true
 *     down:      true
 *     paused:    false
 *     restarted: false
 *   message:           
 *     from:      '+15674557565'
 *     to:        '+31612345678'
 */
var fs         = require('fs');
var moment     = require('moment');
var config     = require('config').twilio;
var CheckEvent = require('../../models/checkEvent');
var ejs        = require('ejs');
 
exports.init = function() {
  // Initialize a REST client in a single line:
  var client =  require('twilio')(config.account_sid, config.auth_token);
  // You can modify the 
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
      var twilioOptions = {
          to: config.message.to,      // Any number Twilio can deliver to
          from: config.message.from,  // A number you bought from Twilio and can use for outbound communication
          body: lines                 // body of the SMS message
      };

      console.log('Notified event by twilio: Check ' + check.name + ' ' + checkEvent.message);
      
      //Send an SMS text message
      client.sendSms(twilioOptions,function(err1, responseData) { //this function is executed when a response is received from Twilio
          if (!err1) { // "err" is an error received during the request, if any

              // "responseData" is a JavaScript object containing data received from Twilio.
              // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
              // http://www.twilio.com/docs/api/rest/sending-sms#example-1

              console.log(responseData.from); // outputs "+14506667788"
              console.log(responseData.body); // outputs "word to your mother."

          }
      }); 
    });
  });
  console.log('Enabled Twilio notifications');
};