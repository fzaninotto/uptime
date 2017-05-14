/**
 * Email plugin
 *
 * Notifies all events (up, down, paused, restarted) by email
 *
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry 
 * to the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     - ./plugins/email
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
 * Here is an example configuration:
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
 *     # The email plugin also uses the main `url` param for hyperlinks in the sent emails
 */
var fs         = require('fs');
var nodemailer = require('nodemailer');
var moment     = require('moment');
var CheckEvent = require('../../models/checkEvent');
var ejs        = require('ejs');
var bunyan = require('bunyan');

exports.initWebApp = function(options) {
  var config = options.config.email;
  var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: config.transport.auth.user,
        pass: config.transport.auth.pass
    },
    logger: bunyan.createLogger({
        name: 'nodemailer'
    }),
    debug: true
  }, {
      // sender info
      from: config.message.from
  });
  var templateDir = __dirname + '/views/';
  CheckEvent.on('afterInsert', function(checkEvent) {
    if (!config.event[checkEvent.message]) return;
    checkEvent.findCheck(function(err, check) {
      if (err) return console.error(err);
      var filename = templateDir + checkEvent.message + '.ejs';
      console.log("filename : " + filename)
      var renderOptions = {
        check: check,
        checkEvent: checkEvent,
        url: options.config.url,
        moment: moment,
        filename: filename
      };
      var lines = ejs.render(fs.readFileSync(filename, 'utf8'), renderOptions).split('\n');
      mailist = config.message.to.split(",")
      let message = {
        to: mailist,
        subject: lines.shift(),
        text: lines.join('\n')
      } ;
      console.log('Sending Mail');
      transporter.sendMail(message, (error, info) => {
          if (error) return console.error('Email plugin error: %s', error);
          console.log('Message sent successfully!');
          console.log('Server responded with "%s"', info.response);
          transporter.close();
      });
    });
  });
  console.log('Enabled Email notifications');
};
