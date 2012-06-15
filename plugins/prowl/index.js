var Prowl       = require('node-prowl');
var CheckEvent  = require('../../models/checkEvent');
var config      = require('config');

var prowl = new Prowl(config.prowl.apiKey);

exports.init = function() {
  registerNewEventsLogger();
};

var registerNewEventsLogger = function() {
  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      var message = "[" + check.name + '] ';
      message += !check.isUp ? 'went down.' : ('went back up after ' + Math.floor(checkEvent.downtime / 1000) + 's of downtime.');
      
      prowl.push(message, 'Uptime notification', function( err, remaining ){
          if( err ) throw err;
          console.log( 'I have ' + remaining + ' calls to the api during current hour.' );
      });
      
    });
  });
};
