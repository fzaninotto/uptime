var poller = require('./poller');

// models
var Target = require('../models/target').Target,
    Ping   = require('../models/ping').Ping;

function Monitor(pollingInterval) {
  this.pollingInterval = (typeof pollingInterval == 'undefined') ? 60000 : pollingInterval;
}

Monitor.prototype.start = function() {
  this.interval = setInterval(this.pollAll, this.pollingInterval);
}

Monitor.prototype.stop = function() {
  clearInterval(this.interval);
}

Monitor.prototype.pollAll = function() {
  Target.find({}, function (err, docs) {
    if (err) console.dir(err);
    docs.forEach(function(doc) {
      p = poller.createPoller(doc.url, function() {
        console.log(doc.url + ' is DOWN');
        Ping.createForTarget(doc, false);
        doc.setLastTest(Date.now(), false).save();
      }, function() {
        console.log(doc.url + ' is UP');
        Ping.createForTarget(doc, true);
        doc.setLastTest(Date.now(), true).save();
      });
      p.setTimeout(doc.timeout);
      //p.setDebug(true);
      p.poll();
    });
  });
}

exports.createMonitor = function(pollingInterval) {
  return new Monitor(pollingInterval);
}

