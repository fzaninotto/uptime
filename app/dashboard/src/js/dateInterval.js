var DateInterval = function(type, date, origin, url, maxZoom) {
  this.type = type;
  this.origin = origin;
  this.url = url;
  this.maxZoom = maxZoom || 'hour';
  this.listeners = {};
  this.stat = {};
  this.stats = [];
  this.setDate(date);
}
DateInterval.prototype.setDate = function(date) {
  this.date = Math.max(Math.min(date, Date.now()), this.origin);
  this.momentForDate = moment(this.date);
  this.begin = this.momentForDate.clone().startOf(this.type);
  this.end = this.momentForDate.clone().endOf(this.type);
  this.trigger('change-date');
  this.refreshData();
}
DateInterval.prototype.update = function(type, date) {
  this.type = type;
  this.setDate(date);
}
DateInterval.prototype.beginsAfterOrigin = function() {
  return this.begin.valueOf() > this.origin.valueOf();
}
DateInterval.prototype.endsBeforeNow = function() {
  return this.end.valueOf() < Date.now();
}
DateInterval.prototype.getNextDate = function(type) {
  type = type || this.type;
  return this.momentForDate.clone().add(type + 's', 1);
}
DateInterval.prototype.getPreviousDate = function(type) {
  type = type || this.type;
  return this.momentForDate.clone().subtract(type + 's', 1);
}
DateInterval.prototype.refreshData = function() {
  var self = this;
  $.getJSON(this.url + 'stats/' + this.type + this.getIntervalQueryString(), function(stats) {
    self.stats = stats;
    self.trigger('refresh-stats');
  });
  $.getJSON(this.url + 'stat/' + this.type + '/' + this.date, function(stat) {
    self.stat = stat;
    self.trigger('refresh-stat');
  });
}
DateInterval.prototype.getIntervalQueryString = function() {
  return '?begin=' + this.begin.valueOf() + '&end=' + this.end.valueOf();
}
DateInterval.prototype.types = ['year', 'month', 'day', 'hour', 'tenminutes'];
DateInterval.prototype.isMaxZoom = function() {
  return (this.type === this.maxZoom);
}
DateInterval.prototype.subType = function(type) {
  type = type || this.type;
  var index = this.types.indexOf(type);
  if (index === -1 || index === 4) return false;
  return this.types[index + 1];
}
DateInterval.prototype.superType = function(type) {
  var index = this.types.indexOf(type);
  if (index <= 0) return false;
  return this.types[index - 1];
}
DateInterval.prototype.getSubTypeDuration = function() {
  var date = new moment();
  return date.endOf(this.subType(this.type)).valueOf() - date.startOf(this.subType(this.type)).valueOf();
}
DateInterval.prototype.on = function(eventName, callback) {
  if (!this.listeners[eventName]) {
    this.listeners[eventName] = [];
  }
  this.listeners[eventName].push(callback);
}
DateInterval.prototype.trigger = function(eventName, params) {
  if (!this.listeners[eventName]) {
    return;
  }
  for (var i=0; i< this.listeners[eventName].length; i++) {
    this.listeners[eventName][i].apply(this, params || []);
  }
}
