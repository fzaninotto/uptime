/**
 * Timer constructor
 *
 * @param {Number} timeout in milliseconds
 * @param {Function} timeout callback
 * @api   public
 */
function Timer(timeout, timeoutCallback) {
  this.finalTime = false;
  this.time = Date.now();
  this.TimerFunction = setTimeout(timeoutCallback, timeout);
}

/**
 * Get time elapsed since timer construction
 *
 * @return {Number} time in milliseconds
 * @api   public
 */
Timer.prototype.getTime = function() {
  return this.finalTime || Date.now() - this.time;
};

/**
 * Stop the timer and prevent the call to the timeout callback
 *
 * @api   public
 */
Timer.prototype.stop = function() {
  this.finalTime = this.getTime();
  clearTimeout(this.TimerFunction);
};

/**
 * Create a timer.
 * 
 * Example:
 *
 *    t = timer.createTimer(60000, function() { console.log('60 seconds have passed'); });
 *    t.getTime(); // 12345
 *    t.stop(); // prevents the execution of the timeout callback
 *
 * @param {Number} Delay to schedule execution of the callback in milliseconds
 * @param {Function} Callback to be executed at the end of the delay, unless the timer is stopped
 * @api   public
 */
exports.createTimer = function(timeout, timeoutCallback) {
  return new Timer(timeout, timeoutCallback);
};
