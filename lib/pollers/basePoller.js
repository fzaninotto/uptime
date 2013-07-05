/**
 * Module dependencies.
 */
var timer = require('../timer');

/**
 * Base Poller constructor
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function BasePoller(target, timeout, callback) {
  this.target = target;
  this.timeout = timeout || 5000;
  this.callback = callback;
  this.isDebugEnabled = false;
  this.initialize();
}

/**
 * Initializer method
 * 
 * Override this method in child classes to prepare the target property.
 * @api   public
 */
BasePoller.prototype.initialize = function() {};

/**
 * Enable or disable debug console output
 *
 * @param {Boolean} bool
 * @api public
 */
BasePoller.prototype.setDebug = function(bool) {
  this.isDebugEnabled = bool;
};

/**
 * Log debug message if debug is enabled
 *
 * @param {String} Message to log
 * @api   private
 */
BasePoller.prototype.debug = function(msg) {
  if (this.isDebugEnabled) console.log(msg);
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
BasePoller.prototype.poll = function() {
  if (!this.timer) { // timer already exists in case of a redirect
    this.timer = timer.createTimer(this.timeout, this.timeoutReached.bind(this));
  }
  this.debug(this.getTime() + "ms - Emitting Request");
};

/**
 * Error callback
 * @api   private
 */
BasePoller.prototype.onErrorCallback = function(err) {
  this.timer.stop();
  this.debug(this.getTime() + "ms - Got error: " + err.message);
  this.callback(err, this.getTime());
};

/**
 * Timeout callback
 *
 * @api   private
 */
BasePoller.prototype.timeoutReached = function() {
  this.onErrorCallback({ name: "TimeOutError", message: "Request Timeout"});
};

/**
 * Proxy to the timer's getTime() method
 *
 * @api   private
 */
BasePoller.prototype.getTime = function() {
  return this.timer.getTime();
};

/**
 * Validate poller target URL (static method)
 * 
 * Override this method in child classes to prepare the target property.
 * @api   public
 */
BasePoller.validateTarget = function(target) {
  return false;
};

module.exports = BasePoller;