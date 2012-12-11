/**
 * Email plugin
 *
 * Notifies all events (up, down, paused, restarted) by email
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./email').init();
 *   }
 *
 * Example configuration
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
var config     = require('config').email;
var CheckEvent = require('../../models/checkEvent');
var ejs        = require('ejs');
 
exports.init = function() {
  var mailer = nodemailer.createTransport(config.method, config.transport);
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
      var lines = ejs.render(fs.readFileSync(filename, 'utf8'), renderOptions).split('\n');
      var mailOptions = {
        from:    config.message.from,
        to:      config.message.to,
        subject: lines.shift(),
        text:    lines.join('\n'),
      };
      mailer.sendMail(mailOptions, function(err2, response) {
        if (err2) return console.error(err2);
        console.log('Notified event by email: Check ' + check.name + ' ' + checkEvent.message);      
      });
    });
  });
  console.log('Enabled Email notifications');
};