var PollerCollection = function(pollers) {
  this.pollers = [];
  this.addDefaultPollers();
};

PollerCollection.prototype.addDefaultPollers = function() {
  this.add(require('./http/httpPoller.js'));
  this.add(require('./https/httpsPoller.js'));
  this.add(require('./icmp/icmpPoller.js'));
  this.add(require('./udp/udpPoller.js'));
};

PollerCollection.prototype.add = function(poller) {
  this.pollers[poller.type] = poller;
};

PollerCollection.prototype.getForType = function(type) {
  return this.pollers[type];
};

PollerCollection.prototype.guessTypeForUrl = function(url) {
  var match = url.match(/^(\w+):\/\//);
  if (!match || !this.pollers[match[1]]) {
    throw new Error('Unable to determine poller type from URL ' + url);
  }
  return match[1];
};

module.exports = PollerCollection;