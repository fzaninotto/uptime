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
    var availPow = Math.pow(availability, 5);
    var color = {
      red: parseInt(185 * (1 - availPow) + 191 * availPow),
      green: parseInt(84 * (1 - availPow) + 210 * availPow),
      blue: parseInt(72 * (1 - availPow) + 85 * availPow)
    };
    return '<div style="background-color:rgb(' + color.red + ',' + color.green + ',' + color.blue + ');left:' + (begin - origin) / duration * 100 + '%;width:' + (end - begin) / duration * 100 + '%" ' 
              + 'title="' + (availability * 100).toFixed(3) + '% availability from '+ moment(begin).format('LL') + ' to ' + moment(end).format('LL') + '">'
         + '</div>'
  }
  var uptimeBar = function(from, to, periods) {
    var ret = '<div class="uptimeBar">';
    var duration = to - from;
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
    var now = Date.now();
    if (from < now && now < to) {
      // hide not yet measured period
      ret += '<div style="background-color:white;left:' + (now - from) / duration * 100 + '%;width:' + (to - now) / duration * 100 + '%"></div>';
    }
    ret += '</div>';
    return ret;
  }

  return uptimeBar;
})();