/**
 * Console plugin
 *
 * Logs all pings and events (up, down, paused, restarted) on the console
 *
 * Installation
 * ------------
 * This plugin is enabled by default. To disable it, remove its entry 
 * from the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     # - ./plugins/console
 */
var Ping = require('../../models/ping');
var CheckEvent = require('../../models/checkEvent');

exports.initWebApp = function(enableNewEvents, enableNewPings) {
  if (typeof enableNewEvents == 'undefined') enableNewEvents = true;
  if (typeof enableNewPings == 'undefined') enableNewPings = true;
  if (enableNewEvents) registerNewEventsLogger();
  if (enableNewPings)  registerNewPingsLogger();
};

var registerNewEventsLogger = function() {
  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      var messageColor;
      var message = check.name + ' ';
      switch (checkEvent.message) {
        case 'paused':
        case 'restarted':
          message += 'was ' + checkEvent.message;
          messageColor = 'blue+bold';
          break;
        case 'down':
          message += 'went down ' + checkEvent.details;
          messageColor = 'red+bold';
          break;
        case 'up':
          if (checkEvent.downtime) {
            message += 'went back up after ' +  Math.floor(checkEvent.downtime / 1000) + 's of downtime';
          } else {
            message += 'is now up';
          }
          messageColor = 'green+bold';
          break;
        default:
         message += '(unknown event)';
         messageColor = 'bold';
      }

      console.log(timestamp() + color(message, messageColor));
    });
  });
};

var registerNewPingsLogger = function() {
  Ping.on('afterInsert', function(ping) {
    ping.findCheck(function(err, check) {
      var message = check.name + ' ';
      message += (ping.isUp) ? color('OK', 'green') : color('responded with error "' + ping.error + '"', 'red');
      console.log(timestamp() + message);
    });
  });
};

// ANSI color code outputs for strings
var ANSI_CODES = {
  "off": 0,
  "bold": 1,
  "italic": 3,
  "underline": 4,
  "blink": 5,
  "inverse": 7,
  "hidden": 8,
  "black": 30,
  "red": 31,
  "green": 32,
  "yellow": 33,
  "blue": 34,
  "magenta": 35,
  "cyan": 36,
  "white": 37,
  "black_bg": 40,
  "red_bg": 41,
  "green_bg": 42,
  "yellow_bg": 43,
  "blue_bg": 44,
  "magenta_bg": 45,
  "cyan_bg": 46,
  "white_bg": 47
};

function color(str, color) {
  if(!color) return str;
  var color_attrs = color.split("+");
  var ansi_str = "";
  for (var i=0, attr; attr = color_attrs[i]; i++) {
    ansi_str += "\033[" + ANSI_CODES[attr] + "m";
  }
  ansi_str += str + "\033[" + ANSI_CODES["off"] + "m";
  return ansi_str;
}

function timestamp() {
  return color(new Date().toLocaleTimeString(), 'cyan') + ' ';
}