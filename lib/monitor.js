/**
 * Module dependencies.
 */
var http = require('http');
var url  = require('url');

/**
 * Monitor constructor
 *
 * The monitor pings the checks regularily and saves the response status and time.
 * The monitor doesn't interact with the model classes directly, but instead uses
 * the REST HTTP API. This way, the monitor can run on a separate process, so that the
 * ping measurements don't get distorted by a heavy usage of the GUI.
 *
 * The constructor expects a configuration object as parameter, with these properties:
 *   pollingInterval: Interval between each poll in milliseconds, defaults to 10 seconds
 *   timeout: Request timeout in milliseconds, defaults to 5 seconds
 *
 * @param {Object} Monitor configuration
 * @api   public
 */
function Monitor(config) {
  config.pollingInterval = config.pollingInterval || 10 * 1000;
  config.timeout = config.timeout || 5 * 1000;
  this.config = config;
}

/**
 * Start the monitoring of all checks.
 *
 * The polling actually starts after the pollingInterval set to the constructor.
 *
 * @api   public
 */
Monitor.prototype.start = function() {
  // start polling right away
  this.pollChecksNeedingPoll();
  // schedule future polls
  this.intervalForPoll   = setInterval(this.pollChecksNeedingPoll.bind(this), this.config.pollingInterval);
  console.log('Monitor ' + this.config.name + ' started');
}

/**
 * Stop the monitoring of all checks
 *
 * @api   public
 */
Monitor.prototype.stop = function() {
  clearInterval(this.intervalForPoll);
}

/**
 * Find checks that need to be polled.
 *
 * A check needs to be polled if it was last polled sine a longer time than its own interval.
 *
 * @param {Function} Callback function to be called with each Check
 * @api   private
 */
Monitor.prototype.pollChecksNeedingPoll = function(callback) {
  var self = this;
  this.findChecksNeedingPoll(function(err, checks) {
    if (err) {
      console.log(err);
      if (callback) callback(err);
      return;
    }
    checks.forEach(function(check) {
      self.pollCheck(check, function(err) {
        if (err) console.log(err);
      });
    });
  }); 
};

Monitor.prototype.findChecksNeedingPoll = function(callback) {
  var api = url.parse(this.config.apiUrl + '/checks/needingPoll');
  var self = this;
  http.get(api, function(res) {
    if (res.statusCode != 200) {
      return callback(new Error(self.config.apiUrl + '/checks/needingPoll resource responded with error code: ' + res.statusCode));
    }
    var body = '';
    res.on('data', function(chunk) {
      body += chunk.toString();
    });
    res.on('end', function() {
      callback(null, JSON.parse(body));
    });
  }).on('error', function(e) {
    callback(new Error(self.config.apiUrl + '/checks/needingPoll resource not available: ' + e.message));
  });
};

/**
 * Poll a given check, and create a ping according to the result.
 *
 * @param {Object} check is a simple JSON object returned by the API, NOT a Check object
 * @api   private
 */
Monitor.prototype.pollCheck = function(check, callback) {
  if (!check) return;
  var self = this;
  var Poller = require('./pollers/' + (check.type || 'http'));
  p = new Poller(check.url, this.config.timeout, function(err, time) {
    self.createPing(check, err, Date.now(), time, callback);
  });
  if ('setUserAgent' in p) {
    p.setUserAgent(this.config.userAgent);
  }
  //p.setDebug(true);
  p.poll();
}

Monitor.prototype.createPing = function(check, error, timestamp, time, callback) {
  status = error ? 'false' : 'true';
  var postData = 'checkId=' + check._id + '&status=' + status + '&timestamp=' + timestamp + '&time=' + time + '&name=' + this.config.name + '&error=' + (error ? error.message : '');
  var options = url.parse(this.config.apiUrl + '/pings');
  options.method = 'POST';
  options.headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': postData.length
  }
  var self = this;
  var req = http.request(options, function(res) {
    if (res.statusCode != 200) {
      return callback(new Error(self.config.apiUrl + '/pings resource responded with error code: ' + res.statusCode));
    }
    var body = '';
    res.on('data', function(chunk) {
    body += chunk;
    });
    res.on('end', function() {
      if (callback) callback(null, body);
    });
  }).on('error', function(e) {
    callback(new Error(self.config.apiUrl + '/pings resource not available: ' + e.message));
  });
  req.write(postData);
  req.end();
}

/**
 * Create a monitor to poll all checks at a given interval.
 * 
 * Example:
 *
 *    m = monitor.createMonitor({ pollingInterval: 60000});
 *    m.start();
 *    // the polling starts, every 60 seconds
 *    m.stop();
 *
 * @param {Object} Configuration object
 * @api   public
 */
exports.createMonitor = function(config) {
  return new Monitor(config);
}
