var TimeCalculator = function(date) {
  this.date = new Date(date);
};

TimeCalculator.prototype.getDate = function() {
  return this.date;
}

TimeCalculator.prototype.resetHour = function() {
  this.date.setUTCMinutes(0);
  this.date.setUTCSeconds(0);
  this.date.setUTCMilliseconds(0);
}

TimeCalculator.prototype.completeHour = function() {
  this.date.setUTCMinutes(59);
  this.date.setUTCSeconds(59);
  this.date.setUTCMilliseconds(999);
}

TimeCalculator.prototype.resetDay = function() {
  this.resetHour();
  this.date.setUTCHours(0);
}

TimeCalculator.prototype.completeDay = function() {
  this.completeHour();
  this.date.setUTCHours(23);
}

TimeCalculator.prototype.resetMonth = function() {
  this.resetDay();
  this.date.setUTCDate(1);
}

TimeCalculator.prototype.completeMonth = function() {
  this.completeDay();
  var currentMonth = this.date.getUTCMonth();
  this.date.setUTCDate(32);
  while (currentMonth < this.date.getUTCMonth()) {
    this.date.setUTCDate(this.date.getUTCDate() - 1);
  }
}

module.exports = function(moment, boundary) {
  var timeCalculator = new TimeCalculator(moment);
  timeCalculator[boundary]();
  return timeCalculator.getDate();
}