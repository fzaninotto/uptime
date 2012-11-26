var CheckEvent = require('../../models/checkEvent');
var nodemailer = require("nodemailer");
var ejs = require('ejs');
var fs = require('fs');
var _ = require('underscore');

exports.init = function(enableChechStatusNotifier) {
  if (typeof enableChechStatusNotifier == 'undefined') enableChechStatusNotifier = true;
  if (enableChechStatusNotifier) registerChechStatusNotifier();
};

var registerChechStatusNotifier = function() {
  console.log('ChechStatusNotifier registered');
  var config = JSON.parse(fs.readFileSync(__dirname+'/config.json', 'utf8'));
  var mailer = nodemailer.createTransport(config.method, config.transportOptions);
  
  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      console.log('ChechStatusNotifier notify');
      if(_.isEmpty(check.email)){
        return;
      }
      
      var renderOptions = {check: check, checkEvent: checkEvent};
      var filename = __dirname+'/templates/'+checkEvent.message+'.ejs';
      var result = ejs.render(fs.readFileSync(filename, 'utf8'), _.extend({
        filename: filename
      }, renderOptions));
      
      var mailOptions = _.extend({
        to : check.email,
        text : result
      }, config.mailOptions);
      mailOptions['subject'] = ejs.render(mailOptions['subject'], renderOptions);

      mailer.sendMail(mailOptions, function(error, response) {
        if (error) {
          console.log(error);
        } else {
          console.log("Message sent: " + response.message);
        }
      });
    });
  });
};
