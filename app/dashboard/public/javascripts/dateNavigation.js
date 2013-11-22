var DateNavigation = function(interval, type, check) {
  this.interval = interval;
  this.initialType = interval.type;
  this.initialDate = interval.date;
  this.init(type, check);
}
DateNavigation.prototype.init = function(type, check) {
  // redraw on date change
  this.redraw();
  var interval = this.interval;
  interval.on('change-date', this.redraw.bind(this));
  
  // change date on click
  $('#dateNavigation').on('click', 'button', function(event) {
    var data = $(this).data();
    interval.update(data.type, parseInt(data.date));
  });
  
  // redraw date range when time passes to enable new interval buttons
  setInterval(this.redrawPeriods.bind(this), 5 * 60 * 1000);

  // redraw uptime bar when the data arrives
  interval.on('refresh-stat', function() {
    var outages = this.stat ? this.stat.outages || [] : [];
    var args = {
      from: interval.begin.valueOf(),
      to: interval.end.valueOf(),
      periods: outages
    }

    if (type == 'check') {
      args.check = check;
    } else if (type == 'tag') {
      args.origin = this.origin.valueOf();
    }

    $('#dateNavigation .timeline').html(
      uptimeBar(type, args)
    );
  });
  
  // pin when scrolling
  $('#dateNavigation').affix({
    offset: $('#dateNavigation').position()
  });

  // manage back navigation
  var popped = (window.history.state);
  var initialURL = location.href
  this.pushStateEnabled = false;
  var self = this;
  interval.on('change-date', function() {
    if (!self.pushStateEnabled || !history.pushState) return;
    history.pushState({ type: this.type, date: this.date, stat: this.stat, stats: this.stats }, null, '?type=' + this.type + '&date=' + this.date + location.hash);
  });
  window.addEventListener('popstate', function(e) {
    // Chrome fires popstate on load, we must ignore that
    var initialPop = !popped && location.href == initialURL;
    popped = true;
    if (initialPop || !self.pushStateEnabled) return;
    var params = e.state;
    if (!params) {
      if (location.href == initialURL) {
        // reached back first page
        params = { type: self.initialType, date: self.initialDate };
      } else {
        // just changed hash - ignoring
        return;
      }
    }
    self.pushStateEnabled = false;
    interval.update(params.type, parseInt(params.date));
    self.pushStateEnabled = true;
  });
  this.pushStateEnabled = true;
}
DateNavigation.prototype.redraw = function() {
  this.redrawTitle()
  this.redrawPeriods();
  this.redrawZoom();
  this.adjustWidth();
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
    if (d.valueOf() < Date.now() && d.clone().endOf(subtype).valueOf() > this.interval.origin && !this.interval.isMaxZoom()) {
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
  if (subType !== false && !this.interval.isMaxZoom()) {
    zoom += '<button class="btn btn-small" data-type="' + subType + '" data-date="' + this.interval.date + '"><li class="icon-zoom-in"></li></button>';
  } else {
    zoom += '<button class="btn btn-small" disabled="disabled"><i class="icon-zoom-in"></i></button>'
  }
  var superType = this.interval.superType(this.interval.type);
  if (superType !== false) {
    zoom += '<button class="btn btn-small" data-type="' + superType + '" data-date="' + this.interval.date + '"><li class="icon-zoom-out"></li></button>';
  } else {
    zoom += '<button class="btn btn-small" disabled="disabled"><i class="icon-zoom-out"></i></button>'
  }
  $('#dateNavigation .zoom').html(zoom);
}
DateNavigation.prototype.adjustWidth = function() {
  var navigationWidth = $('#dateNavigation .periods .btn-group').width() - 58;
  $('#dateNavigation .timeline').width(navigationWidth);
  $('.adjustedOnDateNavigation').width(navigationWidth);
}
