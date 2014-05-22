var async      = require('async');
var mongoose   = require('../bootstrap');
var Check      = require('../models/check');
var CheckEvent = require('../models/checkEvent');
var Ping       = require('../models/ping');

var backInTime = 3 * 30 * 24 * 60 * 60 * 1000; // defaults to 3 months ago

var removeChecks = function(callback) {
  console.log('Removing Checks');
  async.series([
    function(cb) { CheckEvent.collection.remove(cb); },
    function(cb) { Check.collection.remove(cb); }
  ], callback);
};

var createFixtureChecks = function(callback) {
  async.parallel([
    function(cb) { createDummyCheck(99.95, 'Top Quality', ['good', 'all'], cb); },
    function(cb) { createDummyCheck(99.85, 'Good Quality', ['good', 'all'], cb); },
    function(cb) { createDummyCheck(99, 'Neun und neunzig Luftballons', ['average', 'all'], cb); },
    function(cb) { createDummyCheck(80, 'My Unstable Site', ['average', 'all'], cb); },
    function(cb) { createDummyCheck(70, 'The lousy site I built for Al', ['low', 'all'], cb); }
  ], callback);
};

var createDummyCheck = function(quality, name, tags, callback) {
  console.log('Creating check "' + name + '"');
  var check = new Check({
    url: 'http://localhost:8888/' + quality,
    name: name || ('dummy' + quality),
    interval: 300000,
    maxTime: 500,
    tags: tags || ['all']
  });
  check.save(callback);
};

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
          Ping.createForCheck(
            Math.random() < (quality / 100),
            date,
            check.maxTime + (Math.random() - 0.9) * 200,
            check,
            'populator',
            'Dummy Error',
            null,
            cb
          );
          nbPings++;
          if (nbPings % 288 === 0) {
            console.log(new Date(date) + ' Created pings for check "' + check.name + '"');
          }
        },
        callme
      );
  }, callback);
 });
};

async.series([removeChecks, createFixtureChecks, createFixturePings], function(err) {
  if (err) {
    console.dir(err);
  } else {
    console.log('Computing complete');
  }
  setTimeout(function() { mongoose.connection.close(); }, 1000);
});
