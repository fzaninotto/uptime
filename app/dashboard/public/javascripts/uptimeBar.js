var uptimeBar = (function(){
  var barPart = function(type, begin, end, duration) {
    return '<div class="' + type + '" '
              + 'style="width:' + (end - begin) / duration * 100 +'%" ' 
              + 'title="' + type + ' from '+ moment(begin).format('LLL') + ' to ' + moment(end).format('LLL') + '">'
         + '</div>';
  }
  var uptimeBar = function(begin, end, periods) {
    var ret = '<div class="uptimeBar">';
    var nbPeriods = periods.length;
    if (nbPeriods == 0) {
      ret += '<div class="up" style="width:100%"></div></div>';
      return ret;
    }
    var duration = (end - begin) * 1.02; // avoid rounding issues;
    if (periods[0][0] != begin) {
      ret += barPart('up', begin, periods[0][0], duration);
    }
    for (var i = 0; i < nbPeriods; i++) {
      ret += barPart('down', periods[i][0], periods[i][1], duration);
      if (i < nbPeriods - 1 ) {
        ret += barPart('up', periods[i][1], periods[i+1][0], duration);
      }
    }
    if (periods[nbPeriods - 1][1] != end) {
      ret += barPart('up', periods[nbPeriods-1][1], end, duration);
    }
    ret += '</div>';
    return ret;
  }

  return uptimeBar;
})();