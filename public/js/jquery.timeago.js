(function($) {
  $.fn.timeago = function() {
    var self = this;
    var computeTimeFromNow = function() {
      $(this).html(moment($(this).attr('title')).fromNow(true));
    };
    self.each(computeTimeFromNow);
    setInterval(function() { self.each(computeTimeFromNow); }, 60000);
  };
}(jQuery));
