/**
 * Simple Timer object
 */
function Timer(timeout, timeoutCallback) {
  this.time = Date.now();
  this.TimerFunction = setTimeout(timeoutCallback, timeout);
}
Timer.prototype.getTime = function() {
  return Date.now() - this.time;
}
Timer.prototype.stop = function() {
  clearTimeout(this.TimerFunction);
}

exports.createTimer = function(timeout, timeoutCallback) {
  return new Timer(timeout, timeoutCallback);
}