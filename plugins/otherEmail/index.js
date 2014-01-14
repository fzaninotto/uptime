/**
 * otherEmail plugin
 *
 * Notifies all events (up, down, paused, restarted) by email to administrator (config file) and other people defined at check level
 *
 * This is a cut & tune of the default email sender
 * Tuned by Unclephil for his own purpose, and shared because this thing must be like this.  
 * 
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry 
 * to the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     - ./plugins/otherEmail
 *     
 *
 *  IMPORTANT !!!!!!
 *    You MUST DISABLE the normal Email Plugins
 *  
 *
 * Usage
 * -----
 * This plugin sends an email each time a check is started, goes down, or goes back up. 
 * When the check goes down, the email contains the error details:
 *
 *   Object: [Down] Check "FooBar" just went down
 *   On Thursday, September 4th 1986 8:30 PM,
 *   a test on URL "http://foobar.com" failed with the following error:
 *
 *     Error 500
 *
 *   Uptime won't send anymore emails about this check until it goes back up.
 *   ---------------------------------------------------------------------
 *   This is an automated email sent from Uptime. Please don't reply to it.
 *
 * Configuration
 * -------------
 * Here is an example configuration (no change from Email):
 *
 *   // in config/production.yaml
 *   email:
 *     method:      SMTP  # possible methods are SMTP, SES, or Sendmail
 *     transport:         # see https://github.com/andris9/nodemailer for transport options
 *       service:   Gmail
 *       auth:            
 *         user:    foobar@gmail.com
 *         pass:    gursikso
 *     event:
 *       up:        true
 *       down:      true
 *       paused:    false
 *       restarted: false
 *     message:           
 *       from:     'Fred Foo <foo@blurdybloop.com>'
 *       to:       'bar@blurdybloop.com, baz@blurdybloop.com'
 *     dashboardUrl: 'http://localhost:8082'
 */
var fs         = require('fs');
var nodemailer = require('nodemailer');
var moment     = require('moment');
var CheckEvent = require('../../models/checkEvent');
var ejs        = require('ejs');
var express = require('express');

var template = fs.readFileSync(__dirname + '/views/_otherEmailEdit.ejs', 'utf8');

exports.initWebApp = function(options) {
  var config = options.config.email;
  var mailer = nodemailer.createTransport(config.method, config.transport);
  var templateDir = __dirname + '/views/';

  // Unclephil added
  // copied from httpOptions & adapted

  var dashboard = options.dashboard;

  dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
    if (!dirtyCheck.otherEmail) return;
    var otherEmail = dirtyCheck.otherEmail;
      var options = dirtyCheck.otherEmail;
      checkDocument.setPollerParam('otherEmail', options);
  });

  dashboard.on('checkEdit', function(type, check, partial) {
    if (type !== 'http' && type !== 'https') return;
    check.otherEmail = '';
    var options = check.getPollerParam('otherEmail');
    if (options) {
      check.setPollerParam('otherEmail', options);
    }
    partial.push(ejs.render(template, { locals: { check: check } }));
  });

  options.app.use(express.static(__dirname + '/public'));

  //UnclePhil end added


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
      var lines = ejs.render(fs.readFileSync(filename, 'utf8'), renderOptions).split('\n');
      var sendto = config.message.to;
      var otherEmail = check.pollerParams.otherEmail;
      if (otherEmail) {
        if (sendto) {
          sendto += ",";
        }
        sendto += otherEmail ;
      }
      var mailOptions = {
        from:    config.message.from,
        to:      sendto,
        subject: lines.shift(),
        text:    lines.join('\n')
      };
      mailer.sendMail(mailOptions, function(err2, response) {
        if (err2) return console.error('Email plugin error: %s', err2);
        console.log('Notified event by email: Check ' + check.name + ' ' + checkEvent.message);
      });
    });
  });
  console.log('Enabled Email notifications');
};
