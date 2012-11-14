var DateNavigation = function(interval, url) {
  this.interval = interval;
  this.url = url;
  this.interval.on('change-date', this.redraw.bind(this));
  this.init();
}
DateNavigation.prototype.redraw = function() {
  this.redrawTitle()
  this.redrawPeriods();
  this.redrawZoom();
  var navigationWidth = $('#dateNavigation .periods .btn-group').width() - 58;
  $('#dateNavigation .timeline').width(navigationWidth);
  $('.graph').width(navigationWidth);
}
DateNavigation.prototype.titleForPeriod = function(date, type) {
  switch (type) {
    case 'month': return date.format('MMMM');
    case 'day': return date.format('D');
    case 'hour': return date.format('ha');
    case 'tenminutes': 
      return date.format('h:mma') + " to " + date.clone().add('minutes', 10).subtract('seconds', 1).format('h:mma');
  }
}
DateNavigation.prototype.tooltipForPeriod = function(date, type) {
  switch (type) {
    case 'month': return date.format('MMMM YYYY');
    case 'day': return date.format('dddd, LL');
    case 'hour': 
      return "from " + date.format('h:mma') + " to " + date.clone().endOf('hour').format('h:mma');
    case 'tenminutes': return '';
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
  var subtype = this.interval.subType(type);
  var d = begin.clone();
  while (d.valueOf() < end.valueOf()) {
    if (d.valueOf() < Date.now() && d.clone().endOf(subtype).valueOf() > this.interval.origin && subtype != 'tenminutes') {
      periods += '<button class="btn btn-small ' + subtype + ' nb' + end.date() + '" data-type="' + subtype + '" data-date="' + d.valueOf() + '" title="' + this.tooltipForPeriod(d, subtype) + '">' + this.titleForPeriod(d, subtype) + '</button>';
    } else {
      periods += '<button class="btn btn-small ' + subtype + ' nb' + end.date() + '" disabled="disabled">' + this.titleForPeriod(d, subtype) + '</button>';
    }
    if (subtype == 'tenminutes') {
      d.add('minutes', 10);
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
      title += momentForDate.year();
      break;
    case 'month':
      title += momentForDate.format('MMMM');
      title += ' <div class="btn-group"><button class="btn btn-link" data-type="year" data-date="' + this.interval.date + '">';
      title += momentForDate.year();
      title += '</button></div>';
      break;
    case 'day':
      title += momentForDate.format('dddd ');
      title += '<div class="btn-group"><button class="btn btn-link" data-type="month" data-date="' + this.interval.date + '">';
      title += momentForDate.format('MMMM');
      title += '</button></div> ';
      title += momentForDate.format('Do, YYYY');
      break;
    case 'hour':
      title += '<div class="btn-group"><button class="btn btn-link" data-type="day" data-date="' + this.interval.date + '">';
      title += momentForDate.format('dddd MMMM Do');
      title += '</button></div>, ';
      title += momentForDate.clone().startOf('hour').format('ha') + ' to ' + momentForDate.clone().endOf('hour').format('h:mma');
  }
  $('#dateNavigation .title').html(title);
}
DateNavigation.prototype.redrawZoom = function() {
  var zoom = '';
  var subType = this.interval.subType(this.interval.type);
  if (subType !== false && subType != 'tenminutes') {
    zoom += '<button class="btn btn-small" data-type="' + subType + '" data-date="' + this.interval.date + '"><li class="icon-zoom-in"></li></button>';
  } else {
    zoom += '<button class="btn btn-small" disabled="disabled"><li class="icon-zoom-in"></li></button>'
  }
  var superType = this.interval.superType(this.interval.type);
  if (superType !== false) {
    zoom += '<button class="btn btn-small" data-type="' + superType + '" data-date="' + this.interval.date + '"><li class="icon-zoom-out"></li></button>';
  } else {
    zoom += '<button class="btn btn-small" disabled="disabled"><li class="icon-zoom-out"></li></button>'
  }
  $('#dateNavigation .zoom').html(zoom);
}
DateNavigation.prototype.init = function() {
  this.redraw();
  var self = this;
  $('#dateNavigation').on('click', 'button', function(event) {
    var data = $(this).data();
    self.interval.type = data.type;
    self.interval.setDate(parseInt(data.date));
  });
}