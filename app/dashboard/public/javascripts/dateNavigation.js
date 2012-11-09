var DateInterval = function(type, date, origin) {
  this.type = type;
  this.origin = origin;
  this.setDate(date);
  this.listeners = {};
  this.stat = {};
  this.stats = [];
}
DateInterval.prototype.setDate = function(date) {
  this.date = Math.max(Math.min(date, Date.now()), this.origin);
  this.momentForDate = moment(this.date);
  this.begin = this.momentForDate.clone().startOf(this.type);
  this.end = this.momentForDate.clone().endOf(this.type);
}
DateInterval.prototype.beginsAfterOrigin = function () {
  return this.begin.valueOf() > this.origin.valueOf();
}
DateInterval.prototype.endsBeforeNow = function () {
  return this.end.valueOf() < Date.now();
}
DateInterval.prototype.getNextDate = function (type) {
  type = type || this.type;
  return this.momentForDate.clone().add(type + 's', 1);
}
DateInterval.prototype.getPreviousDate = function (type) {
  type = type || this.type;
  return this.momentForDate.clone().subtract(type + 's', 1);
}
DateInterval.prototype.refreshData = function(url) {
  var self = this;
  $.getJSON(url + 'stats/' + this.type + '?begin=' + this.begin.valueOf() + '&end=' + this.end.valueOf(), function(stats) {
    self.stats = stats;
    self.trigger('refresh-stats');
  });
  $.getJSON(url + 'stat/' +this.type + '/' + this.date, function(stat) {
    self.stat = stat;
    self.trigger('refresh-stat');
  });
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
  var i;
  for (i in this.listeners[eventName]) {
    this.listeners[eventName][i].apply(this, params || []);
  }
}


var DateNavigation = function(interval, url) {
  this.interval = interval;
  this.url = url;
  this.init();
}
DateNavigation.prototype.redraw = function() {
  this.redrawTitle()
  this.redrawPeriods();
  $('#dateNavigation .timeline').width($('#dateNavigation .periods .btn-group').width() - 58);
  this.interval.refreshData(this.url);
}
DateNavigation.prototype.subType = {
  'year': 'month',
  'month': 'day',
  'day': 'hour',
  'hour': 'quarter'
}
DateNavigation.prototype.titleForPeriod = function(date, type) {
  switch (type) {
    case 'month': return date.format('MMMM');
    case 'day': return date.format('D');
    case 'hour': return date.format('ha');
    case 'quarter': 
      return date.format('h:mma') + " to " + date.clone().add('minutes', 15).subtract('seconds', 1).format('h:mma');
  }
}
DateNavigation.prototype.tooltipForPeriod = function(date, type) {
  switch (type) {
    case 'month': return date.format('MMMM YYYY');
    case 'day': return date.format('dddd, LL');
    case 'hour': 
      return "from " + date.format('h:mma') + " to " + date.clone().endOf('hour').format('h:mma');
    case 'quarter': return '';
  }
}
DateNavigation.prototype.redrawPeriods = function() {
  var type  = this.interval.type;
  var periods = '<div class="btn-group">';
  if (this.interval.beginsAfterOrigin()) {
    periods += '<button class="btn btn-small" data-type="' + type + '" data-date="' + this.interval.getPreviousDate() + '">&lt;</button>';
  } else {
    periods += '<button class="btn btn-small" disabled="disabled">&lt;</button>';
  }
  var begin = this.interval.begin;
  var end   = this.interval.end;
  var subtype = this.subType[type];
  var d = begin.clone();
  while (d.valueOf() < end.valueOf()) {
    if (d.valueOf() < Date.now() && d.clone().endOf(subtype).valueOf() > this.interval.origin && subtype != 'quarter') {
      periods += '<button class="btn btn-small ' + subtype + ' nb' + end.date() + '" data-type="' + subtype + '" data-date="' + d.valueOf() + '" title="' + this.tooltipForPeriod(d, subtype) + '">' + this.titleForPeriod(d, subtype) + '</button>';
    } else {
      periods += '<button class="btn btn-small ' + subtype + ' nb' + end.date() + '" disabled="disabled">' + this.titleForPeriod(d, subtype) + '</button>';
    }
    if (subtype == 'quarter') {
      d.add('minutes', 15);
    } else {
      d.add(subtype + 's', 1);
    }
  }
  if (this.interval.endsBeforeNow()) {
    periods += '<button class="btn btn-small" data-type="' + type + '" data-date="' + this.interval.getNextDate() + '">&gt;</button>';
  } else {
    periods += '<button class="btn btn-small" disabled="disabled">&gt;</button>';
  }
  periods += '</div>';
  $('#dateNavigation .periods').html(periods);
}
DateNavigation.prototype.redrawTitle = function() {
  var title = '';
  var momentForDate = this.interval.momentForDate;
  switch (this.interval.type) {
    case 'year':
      title += '<br/>' + momentForDate.year();
      break;
    case 'month':
      title += '<button class="btn btn-link" data-type="year" data-date="' + this.interval.date + '">';
      title += momentForDate.year();
      title += '</button><br/>';
      title += momentForDate.format('MMMM');
      break;
    case 'day':
      title += '<button class="btn btn-link" data-type="month" data-date="' + this.interval.date + '">';
      title += momentForDate.format('MMMM');
      title += '</button><br/>';
      title += momentForDate.format('dddd Do');
      break;
    case 'hour':
      title += '<button class="btn btn-link" data-type="day" data-date="' + this.interval.date + '">';
      title += momentForDate.format('dddd Do');
      title += '</button><br/>';
      title += momentForDate.clone().startOf('hour').format('ha') + ' to ' + momentForDate.clone().endOf('hour').format('h:mma');
  }
  $('#dateNavigation .title').html(title);
}
DateNavigation.prototype.init = function() {
  this.redraw();
  var self = this;
  $(document).on('click', '#dateNavigation button', function(event) {
    var buttonData = $(this).data();
    self.interval.type = buttonData.type;
    self.interval.setDate(parseInt(buttonData.date));
    self.redraw();
  });
}