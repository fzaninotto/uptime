var StatNavigation = function(interval) {
  this.interval = interval;
  this.init();
}
StatNavigation.prototype.init = function() {
  this.interval.on('refresh-stat', function() {
    var statPane = $('#secondaryNav');
    var stat = this.stat;
    if (stat && stat.availability) {
      statPane.find('.availability').text(stat.availability.replace('.000', ''));
      statPane.find('.responsiveness').text(stat.responsiveness.replace('.000', ''));
      statPane.find('.avgRespTime').text(stat.responseTime);
      if (stat.downtime) {
        statPane.find('.downtime').text(moment.duration(stat.downtime, 'seconds').humanize());
        statPane.find('.downtime').parentsUntil('li').show();
        $('#events').show();
      } else {
        statPane.find('.downtime').parentsUntil('li').hide();
        $('#events').hide();
      }
    }
  });
  $('#secondaryNav').affix({
    offset: $('#dateNavigation').position()
  });
}
