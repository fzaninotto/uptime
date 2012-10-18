var uptimeBar = (function(){
  var outageBar = function(begin, end, origin, duration) {
    return '<div class="down" '
              + 'style="left:' + (begin - origin) / duration * 100 + '%;width:' + (end - begin) / duration * 100 + '%" ' 
              + 'title="' + moment.duration(end-begin).humanize() + ' outage from '+ moment(begin).format('LLL') + ' to ' + moment(end).format('LLL') + '">'
         + '</div>';
  }
  var uptimeBar = function(from, to, periods) {
    var ret = '<div class="uptimeBar">';
    var duration = to - from;
    var nbPeriods = periods.length;
    for (var i = 0; i < nbPeriods; i++) {
      ret += outageBar(periods[i][0], periods[i][1], from, duration);
    }
    ret += '</div>';
    return ret;
  }

  return uptimeBar;
})();