/**
 * Module dependencies.
 */
var http  = require('http'),
    url   = require('url'),
    timer = require('./timer');

/**
 * Poller constructor
 *
 * @param {String} Url to poll, e.g 'http://www.google.com/index.html'
 * @param {Function} Error callback
 * @param {function} Success callback
 * @api   public
 */
function Poller(pollingUrl, onError, onSuccess) {
  this.location = url.parse(pollingUrl);
  this.onError = onError;
  this.onSuccess = onSuccess;
  this.timeout = 5000;
  this.isDebugEnabled = false;
  this.proxy = {};
}

/**
 * Whether this pool must use a proxy or not
 *
 * @return {Boolean}
 * @api private
 */
Poller.prototype.hasProxy = function() {
  return typeof this.proxy.host !== 'undefined';
}

/**
 * Get the proxied location
 *
 * @return {Object} location
 * @api private
 */
Poller.prototype.getProxiedLocation = function() {
  return this.hasProxy() ? { host: this.proxy.host, port: this.proxy.port, path: this.location.href } : this.location;
}

/**
 * Enable or disable debug console output
 *
 * @param {Boolean} bool
 * @api public
 */
Poller.prototype.setDebug = function(bool) {
  this.isDebugEnabled = bool;
}

/**
 * Log debug message if debug is enabled
 *
 * @param {String} Message to log
 * @api   private
 */
Poller.prototype.debug = function(msg) {
  if(this.isDebugEnabled) console.log(msg);
}

/**
 * Error callback
 * @api   private
 */
Poller.prototype.onErrorCallback = function(err) {
  this.timer.stop();
  this.debug(this.getTime() + "ms - Got error: " + err.message);
  if (this.onError) this.onError(this.getTime(), err.message);
}

/**
 * Response callback
 *
 * Note that all responses may not be successful, as some return non-200 status codes,
 * and others return too slowly.
 * This method handles redirects.
 *
 * @api   private
 */
Poller.prototype.onResponseCallback = function(res) {
  var statusCode = res.statusCode;
  var poller = this;
  if (statusCode == 301 || statusCode == 302) {
    this.location = url.parse(res.headers.location);
    this.debug(this.getTime() + "ms - Got redirect response to " + this.location.href);
    return this.poll();
  }
  if (statusCode == 200) {
   this.debug(this.getTime() + "ms - Status code 200 OK");
    res.on('data', function(chunk) {
      poller.debug(poller.getTime() + 'ms - BODY: ' + chunk.toString().substring(0, 100) + '...');
    });
    res.on('end', function() {
      poller.timer.stop();
      poller.debug(poller.getTime() + "ms - Request Finished");
      if (poller.onSuccess) poller.onSuccess(poller.getTime());
    });
  } else {
    this.request.abort();
    this.onErrorCallback({ name: "NonOkStatusCode", message: "HTTP status " + statusCode});
  }
}

/**
 * Launch the actual polling
 *
 * @api   public
 */
Poller.prototype.poll = function() {
  if (!this.timer) { // timer already exists in case of a redirect
    this.timer = timer.createTimer(this.timeout, this.timeoutReached.bind(this));
  }
  this.debug(this.getTime() + "ms - Emitting Request");
  this.request = http.get(this.getProxiedLocation(), this.onResponseCallback.bind(this));
  this.request.on('error', this.onErrorCallback.bind(this));
}

/**
 * Timeout callback
 *
 * @api   private
 */
Poller.prototype.timeoutReached = function() {
  this.request.abort();
  this.onErrorCallback({ name: "TimeOutError", message: "Request Timeout"});
}

/**
 * Proxy to the timer's getTime() method
 *
 * @api   private
 */
Poller.prototype.getTime = function() {
  return this.timer.getTime();
}

/**
 * Create a poller for a given URL.
 *
 * A poller calls an URL once, which results in the call of one of the two
 * callbacks (success or failure).
 * 
 * Example:
 *
 *    p = poller.createPoller(
 *      'http://www.google.com/index.html',
 *       function()    { console.log('google is up'); },
 *       function(err) { console.log('google is down: ' + err.message );}
 *    );
 *    p.setTimeout(1000);
 *    p.poll();
 *
 * @param {String} URL to poll
 * @api   public
 */
exports.createPoller = function(pollingUrl, onError, onSuccess) {
  return new Poller(pollingUrl, onError, onSuccess);
}
