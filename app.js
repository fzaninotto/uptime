/*
 * Monitor remote server uptime.
 */

var mongoose = require('mongoose'),
    poller   = require('./lib/poller');

// models
var Target = require('./models/target').Target,
    Ping   = require('./models/ping').Ping;

// configure mongodb
var mongodbUser = 'root';
var mongodbPassword = '';
var mongodbServer = 'localhost';
var mongodbDatabase = 'uptime';
mongoose.connect('mongodb://' + mongodbUser + ':' + mongodbPassword + '@' + mongodbServer +'/' + mongodbDatabase);

// clear database
Target.remove({}, function (err) {
  if (err) console.dir(err);
});

// add two targets
t = new Target();
t.url = 'http://www.google.com/index.html';
t.timeout = 300;
t.save(function (err) {
  if (err) console.dir(err);
});
t = new Target();
t.url = 'http://www.yahoo.com/';
t.timeout = 1000;
t.save(function (err) {
  if (err) console.dir(err);
});

// poll targets
Target.find({}, function (err, docs) {
  if (err) console.dir(err);
  docs.forEach(function(doc) {
    p = poller.createPoller(doc.url, function() {
      console.log(doc.url + ' is DOWN');
      ping = new Ping();
      ping.isUp = false;
      ping.date = Date.now();
      ping.target = doc;
      ping.save();
      doc.setLastTest(Date.now(), false).save();
    }, function() {
      console.log(doc.url + ' is UP');
      ping = new Ping();
      ping.isUp = true;
      ping.date = Date.now();
      ping.target = doc;
      ping.save();
      doc.setLastTest(Date.now(), true).save(); 
    });
    p.setTimeout(doc.timeout);
    //p.setDebug(true);
    p.poll();
  });
});

// mongoose is still open, so the script won't return
