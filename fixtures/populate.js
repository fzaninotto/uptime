var mongoose = require('mongoose'),
    config   = require('../config/config.js');

// configure mongodb
mongoose.connect('mongodb://' + config.mongodbUser + ':' + config.mongodbPassword + '@' + config.mongodbServer +'/' + config.mongodbDatabase);

// models dependencies
var Check   = require('../models/check');
var Ping   = require('../models/ping');

// remove existing checks
Check.collection.drop(function(err) {
  createFixtures();
  console.log('Waiting for creation to finish...');
  setTimeout(function() { 
    mongoose.connection.close();
  }, 1000)
});

function createFixtures() {
  createPingsForCheck(createDummyCheck(99.95, 'Top Quality', ['good', 'all']));
  createPingsForCheck(createDummyCheck(99.85, 'Good Quality', ['good', 'all']));
  createPingsForCheck(createDummyCheck(99, 'Neun und neunzig Luftballons', ['average', 'all']));
  createPingsForCheck(createDummyCheck(80, 'My Crappy Site', ['average', 'all']));
  createPingsForCheck(createDummyCheck(99, 'The Crappy site I built for Al', ['low', 'all']));
}

function createDummyCheck(quality, name, tags) {
  var check = new Check({
    url: 'http://localhost:8888/' + quality,
    name: name || ('dummy' + quality),
    interval: 60000,
    maxTime: 500,
    tags: tags || ['all']
  });
  check.save();
  console.log('Creating check "' + check.name + '"');
  return check;
}

function createPingsForCheck(check, startDate, quality) {
  var now = Date.now();
  var date = startDate || (now - 15 * 24 * 60 * 60 * 1000); // defaults to 15 days ago
  quality = quality || parseFloat(check.url.substr(22));
  var nbPings = 0;
  while (date < now) {
    var ping = new Ping();
    ping.date = date;
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
    ping.save();
    nbPings++;
    if (nbPings % 10000 == 0) {
      console.log('Creating ' + nbPings + ' pings for check "' + check.name + '" (' + ping.date + ')');
    };
    date += check.interval;
  }
}