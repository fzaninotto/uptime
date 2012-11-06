var DateNavigation = function(type, date, origin) {
  this.type = type;
  this.origin = origin;
  this.setDate(date);
  this.redraw();
  this.init();
}
DateNavigation.prototype.setDate = function(date) {
  this.date = Math.max(Math.min(date, Date.now()), this.origin);
  this.momentForDate = moment(this.date);
}
DateNavigation.prototype.redraw = function() {
  this.updateTitle()
  this.updatePeriods();
  $('#dateNavigation .timeline')
    .width($('#dateNavigation .periods .btn-group').width() - 58)
    .data({ type: this.type, date: this.date })
    .trigger('refresh');
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
DateNavigation.prototype.updatePeriods = function() {
  var begin = this.momentForDate.clone().startOf(this.type);
  var end   = this.momentForDate.clone().endOf(this.type);
  var periods = '<div class="btn-group">';
  if (begin.valueOf() > this.origin) {
    periods += '<button class="btn btn-small" data-type="' + this.type + '" data-date="' + this.momentForDate.clone().subtract(this.type + 's', 1) + '">&lt;</button>';
  } else {
    periods += '<button class="btn btn-small" disabled="disabled">&lt;</button>';
  }
  var d = begin;
  var subtype = this.subType[this.type];
  while (d.valueOf() < end.valueOf()) {
    if (d.valueOf() < Date.now() && d.valueOf() > this.origin && subtype != 'quarter') {
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
  if (end.valueOf() < Date.now()) {
    periods += '<button class="btn btn-small" data-type="' + this.type + '" data-date="' + this.momentForDate.clone().add(this.type + 's', 1) + '">&gt;</button>';
  } else {
    periods += '<button class="btn btn-small" disabled="disabled">&gt;</button>';
  }
  periods += '</div>';
  $('#dateNavigation .periods').html(periods);
}
DateNavigation.prototype.updateTitle = function() {
  var title = '';
  switch (this.type) {
    case 'year':
      title += '<br/>' + this.momentForDate.year();
      break;
    case 'month':
      title += '<button class="btn btn-link" data-type="year" data-date="' + this.date + '">';
      title += this.momentForDate.year();
      title += '</button><br/>';
      title += this.momentForDate.format('MMMM');
      break;
    case 'day':
      title += '<button class="btn btn-link" data-type="month" data-date="' + this.date + '">';
      title += this.momentForDate.format('MMMM');
      title += '</button><br/>';
      title += this.momentForDate.format('dddd Do');
      break;
    case 'hour':
      title += '<button class="btn btn-link" data-type="day" data-date="' + this.date + '">';
      title += this.momentForDate.format('dddd Do');
      title += '</button><br/>';
      title += this.momentForDate.clone().startOf('hour').format('ha') + ' to ' + this.momentForDate.clone().endOf('hour').format('h:mma');
  }
  $('#dateNavigation .title').html(title);
}
DateNavigation.prototype.init = function() {
  var self = this;
  $(document).on('click', '#dateNavigation button', function(event) {
    self.type = $(this).data('type');
    self.setDate(parseInt($(this).data('date')));
    self.redraw();
  });
}