var uptimeBar = (function(){
  var outageBar = function(begin, end, origin, duration) {
    return '<div class="down" '
              + 'style="left:' + (begin - origin) / duration * 100 + '%;width:' + (end - begin) / duration * 100 + '%" ' 
              + 'title="' + moment.duration(end-begin).humanize() + ' outage from '+ moment(begin).format('LLL') + ' to ' + moment(end).format('LLL') + '">'
         + '</div>';
  }
  var pauseBar = function(begin, end, origin, duration) {
    return '<div class="pause" '
              + 'style="left:' + (begin - origin) / duration * 100 + '%;width:' + (end - begin) / duration * 100 + '%" ' 
              + 'title="' + moment.duration(end-begin).humanize() + ' pause from '+ moment(begin).format('LLL') + ' to ' + moment(end).format('LLL') + '">'
         + '</div>';
  }
  var availabilityBar = function(begin, end, availability, origin, duration) {
    if (availability == 1) return '';
    var intensity = 1 - Math.pow(availability, 10) * 0.8;
    return '<div class="down" style="opacity: ' + intensity + ';left:' + (begin - origin) / duration * 100 + '%;width:' + (end - begin) / duration * 100 + '%" ' 
              + 'title="' + (availability * 100).toFixed(3) + '% availability from '+ moment(begin).format('LL') + ' to ' + moment(end).format('LL') + '">'
         + '</div>'
  }

  var uptimeBar = function(type, args) {
    if (type === 'check') {
      return uptimeBarCheck(args);
    } else if (type === 'tag') {
      return uptimeBarTag(args);
    } else {
      return new Error('unkown type');
    }
  }

  var uptimeBarCheck = function(args) {
    var from = args.from;
    var to = args.to;
    var check = args.check;
    var periods = check.qos.outages || [];
    var now = Date.now();
    var currentIntervalBegin = null;
    var duration = to - from;
    var firstChecked = new Date(check.firstTested).valueOf();
    var lastChanged = new Date(check.lastChanged).valueOf();
    var ret = '<div class="uptimeBar">';

    // create period bar for each element
    if (periods) {
      var nbPeriods = periods.length;
      for (var i = 0; i < nbPeriods; i++) {

        // don't mind these periods
        if (periods[i][0] > to || periods[i][1] < from) {
          continue;
        }
        currentIntervalBegin = periods[i][1];

        // add limit to current status
        periods[i][0] = Math.max(periods[i][0], from);
        periods[i][1] = Math.min(periods[i][1], to);

        // build bars
        if (periods[i][2] == 0 || typeof periods[i][2] == 'undefined') {
          ret += outageBar(periods[i][0], periods[i][1], from, duration);
        } else if (periods[i][2] == -1) {
          ret += pauseBar(periods[i][0], periods[i][1], from, duration);
        } else {
          ret += availabilityBar(periods[i][0], periods[i][1], periods[i][2], from, duration);
        }
      }
    }

    // if current state is not up : change the bar for this period
    if (!check.isUp || check.isPaused) {
      if (currentIntervalBegin == null) {
        currentIntervalBegin = Math.max(firstChecked, from);
      }

      // if the status has changed since the current interval,
      // then the status was up from currentIntervalBegin to status changed
      if (lastChanged > currentIntervalBegin) {
        ret += availabilityBar(currentIntervalBegin, lastChanged, from, duration);
        currentIntervalBegin = lastChanged;
      }

      // add current interval bar
      if (check.isPaused) {
        ret += pauseBar(currentIntervalBegin, Math.min(now, to), from, duration);
      } else {
        ret += outageBar(currentIntervalBegin, Math.min(now, to), from, duration);
      }
    }


    // hide not measured period
    if (from < firstChecked && firstChecked < to) {
      ret += '<div style="background-color:white;left:0;width:' + (firstChecked - from) / duration * 100 + '%"></div>';
    }

    // hide not yet measured period
    if (from < now && now < to) {
      // hide not yet measured period
      ret += '<div style="background-color:white;right:0;width:' + (to - now) / duration * 100 + '%"></div>';
    }
    ret += '</div>';

    return ret;
  }


  var uptimeBarTag = function(args) {

    var from = args.from;
    var to = args.to;
    var origin = args.origin;
    var periods = args.periods;

    var ret = '<div class="uptimeBar">';
    var duration = to - from;
    if (periods) {
      var nbPeriods = periods.length;
      for (var i = 0; i < nbPeriods; i++) {
        if (periods[i][2] == 0 || typeof periods[i][2] == 'undefined') {
          ret += outageBar(periods[i][0], periods[i][1], from, duration);
        } else if (periods[i][2] == -1) {
          ret += pauseBar(periods[i][0], periods[i][1], from, duration);
        } else {
          ret += availabilityBar(periods[i][0], periods[i][1], periods[i][2], from, duration);
        }
      }
    }
    if (from < origin && origin < to) {
      // hide not measured period
      ret += '<div style="background-color:white;left:0;width:' + (origin - from) / duration * 100 + '%"></div>';
    }
    var now = Date.now();
    if (from < now && now < to) {
      // hide not yet measured period
      ret += '<div style="background-color:white;right:0;width:' + (to - now) / duration * 100 + '%"></div>';
    }
    ret += '</div>';
    return ret;
  }

  return uptimeBar;
})();
