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
      statPane.find('.downtime').text(stat.downtime ? moment.duration(stat.downtime, 'seconds').humanize() : '-');
    }
  });
  $('#secondaryNav').affix({
    offset: $('#dateNavigation').position()
  });
}