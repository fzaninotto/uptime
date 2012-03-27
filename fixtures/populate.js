var mongoose = require('mongoose'),
    config   = require('config').mongodb,
    async    = require('async');

// configure mongodb
mongoose.connect('mongodb://' + config.user + ':' + config.password + '@' + config.server +'/' + config.database);

// models dependencies
var Check   = require('../models/check');
var Ping   = require('../models/ping');

var backInTime = 30 * 24 * 60 * 60 * 1000; // defaults to 30 days ago

var removeChecks = function(callback) {
  console.log('Removing Checks');
  Check.collection.remove(callback);
}

var createFixtureChecks = function(callback) {
  async.parallel([
    function(cb) { createDummyCheck(99.95, 'Top Quality', ['good', 'all'], cb); },
    function(cb) { createDummyCheck(99.85, 'Good Quality', ['good', 'all'], cb); },
    function(cb) { createDummyCheck(99, 'Neun und neunzig Luftballons', ['average', 'all'], cb); },
    function(cb) { createDummyCheck(80, 'My Unstable Site', ['average', 'all'], cb); },
    function(cb) { createDummyCheck(70, 'The lousy site I built for Al', ['low', 'all'], cb); },
  ], callback);
}

var createDummyCheck = function(quality, name, tags, callback) {
  console.log('Creating check "' + name + '"');
  var check = new Check({
    url: 'http://localhost:8888/' + quality,
    name: name || ('dummy' + quality),
    interval: 60000,
    maxTime: 500,
    tags: tags || ['all']
  });
  check.save(callback);
}

var createFixturePings = function(callback) {
  Check.find({}, function(err, checks) {
    async.forEach(checks, function(check, callme) {
      var now = Date.now();
      var date = now - backInTime;
      var nbPings = 0;
      var quality = parseFloat(check.url.substr(22));
      async.whilst(
        function() { date += check.interval; return date < now; },
        function(cb) {
          var ping = new Ping();
          ping.timestamp = date;
          ping.isUp = Math.random() < (quality / 100);
          ping.time = check.maxTime + (Math.random() - 0.9) * 200;
          ping.check = check;
          ping.tags = check.tags;
          if (!ping.isUp) {
            ping.isResponsive = false;
            ping.downtime = check.interval;
            ping.error = 'Dummy Error';
          } else {
            ping.isResponsive = ping.time < check.maxTime;
          }
          ping.save(cb);
          nbPings++;
          if (nbPings % 1440 == 0) {
            console.log(ping.timestamp + ' Created pings for check "' + check.name + '"');
          };
        },
        callme
      );
  }, callback);
 });
}

async.series([removeChecks, createFixtureChecks, createFixturePings], function(err) {
  if (err) {
    console.dir(err);
  } else {
    console.log('Computing complete');
  }
  setTimeout(function() { mongoose.connection.close(); }, 1000);
});