/*
 * Monitor remote server uptime.
 */

var mongoose = require('mongoose'),
    poller   = require('./lib/poller'),
    schema   = require('./lib/schema');

// configure mongodb
var mongodbUser = 'root';
var mongodbPassword = '';
var mongodbServer = 'localhost';
var mongodbDatabase = 'uptime';
mongoose.connect('mongodb://' + mongodbUser + ':' + mongodbPassword + '@' + mongodbServer +'/' + mongodbDatabase);

// clear database
schema.Target.remove({}, function (err) {
  if (err) console.dir(err);
});

// add two targets
t = new schema.Target();
t.url = 'http://www.google.com/index.html';
t.timeout = 300;
t.save(function (err) {
  if (err) console.dir(err);
});
t = new schema.Target();
t.url = 'http://www.yahoo.com/';
t.timeout = 1000;
t.save(function (err) {
  if (err) console.dir(err);
});

// poll targets
schema.Target.find({}, function (err, docs) {
  if (err) console.dir(err);
  docs.forEach(function(doc) {
    p = poller.createPoller(doc.url, function() {
      console.log(doc.url + ' is DOWN');
      doc.setLastTest(Date.now(), false).save();
    }, function() {
      console.log(doc.url + ' is UP');
      doc.setLastTest(Date.now(), true).save(); });
    p.setTimeout(doc.timeout);
    //p.setDebug(true);
    p.poll();
  });
});

// mongoose is still open, so the script won't return
