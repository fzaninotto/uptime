var async      = require('async');
var fs         = require('fs');
var CheckEvent = require('../../models/checkEvent');
var pushover   = require('pushover-notifications');
var ejs        = require('ejs');
var moment     = require('moment');

exports.initWebApp = function (options) {
  CheckEvent.on('afterInsert', function(checkEvent) {
    if (!options.config.pushover.event[checkEvent.message]) return;
    checkEvent.findCheck(push(options, checkEvent));
  });
  console.log('Enabled Pushover notifications');
};

function push(options, checkEvent) {
  var config = options.config.pushover;
  return function (err, check) {
    if (err) return console.error(err);

    var templateDir = __dirname + '/views/';
    var filename = templateDir + checkEvent.message + '.ejs';
    var renderOptions = {
      check: check,
      checkEvent: checkEvent,
      url: options.config.url,
      moment: moment,
      filename: filename
    };
    var lines = ejs.render(fs.readFileSync(filename, 'utf8'), renderOptions).split('\n');

    async.forEachSeries(config.users, function (user, callback) {
      var push = new pushover({
        token: config.token,
        user: user
      });
      
      var msg = {
        title: lines.shift(),
        message: lines.join('\n'),
        priority: 1,
        url: options.config.url + '/dashboard/checks/' + check._id + '?type=hour&date=' + checkEvent.timestamp.valueOf(),
        url_title: 'For details, click here'
      };

      push.send(msg, callback);
    }, function (err) {
      if (err) return console.error(err);
      console.log('Notified event by pushover: Check ' + check.name + ' ' + checkEvent.message);
    });
  };
}
