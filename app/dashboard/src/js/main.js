var activateMenu = function(/* int */ position) {
    $('.navbar-nav li').eq(position).addClass('active');
};

var nbNewEvents = 0;
var loadedAt = new Date();

/**
 * Called from layout.ejs
 */
jQuery(function($) {
    var changeFavicon = function(red) {
        $('#favicon').attr('href', '/dashboard/img/favicon' + (red ? '_red' : '') + '.ico');
    }

    var updateCounts = function() {
        $.getJSON('/api/checks/count', function(count) {
            if (count.total > 0) {
                $('#all_up').show().children('strong').text(count.up);
            } else {
                $('#all_up').hide();
            }

            if (count.down > 0) {
                $('#all_down').show().children('strong').text(count.down);
                changeFavicon(true);
            } else {
                $('#all_down').hide();
                if (nbNewEvents > 0) {
                    changeFavicon(false);
                }
            }
            
            if (nbNewEvents > 0) {
                document.title = '(' + nbNewEvents +') Uptime';
            };
        });
    };

    socket.on('CheckEvent', function() {
        nbNewEvents++;
        updateCounts();
        $('#check_summary').fadeOut().fadeIn().fadeOut().fadeIn();
        $('#new_events a').html(nbNewEvents + ' new event' + (nbNewEvents > 1 ? 's' : '') + ' since ' + moment(loadedAt).format('LLL'));
    });

    updateCounts();
});