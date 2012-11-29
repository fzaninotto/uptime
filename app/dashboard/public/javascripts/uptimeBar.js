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
  var uptimeBar = function(from, to, origin, periods) {
    var ret = '<div class="uptimeBar">';
    var duration = to - from;
    if (periods) {
      var nbPeriods = periods.length;
      for (var i = 0; i < nbPeriods; i++) {
        if (periods[i][2] == 0 || typeof periods[i][2] == 'undefined') {
          ret += outageBar(periods[i][0], periods[i][1], from, duration);
        } else if(periods[i][2] == -1) {
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