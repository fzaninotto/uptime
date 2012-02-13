var page = {};
var handlePagination = function(page_name, selector, callback) {
  callback();
  $(selector + ' .recent').hide();
  $(selector + ' .old').click(function(){
    page[page_name]++;
    callback();
    $(selector + ' .recent').show();
    return false;
  });
  $(selector + ' .recent').click(function(){
    page[page_name]--;
    callback();
    if (page[page_name] == 0) {
      $(this).hide();
    };
    return false;
  }).dblclick(function(){
    page[page_name] = 0;
    callback();
    $(this).hide();
  });
}
