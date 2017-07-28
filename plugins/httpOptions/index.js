/**
 * HTTP options plugin
 *
 * Add options to a HTTP/HTTPS poller on a per-check basis
 *
 * Installation
 * ------------
 * This plugin is enabled by default. To disable it, remove its entry 
 * from the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     # - ./plugins/httpOptions
 *
 * Usage
 * -----
 * Add the custom HTTP/HTTPS options in the 'HTTP Options' textarea displayed 
 * in the check Edit page, in YAML format. For instance:
 *
 * method: HEAD
 * headers:
 *   User-Agent: This Is Uptime Calling
 *   X-My-Custom-Header: FooBar
 *
 * See the Node documentation for a list of available options.
 *
 * When Uptime polls a HTTP or HTTPS check, the custom options override
 * the ClientRequest options.
 */
var fs   = require('fs');
var ejs  = require('ejs');
var yaml = require('js-yaml');
var express = require('express');

var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');

function validateFilePath(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch (err) {
    console.log(err);
    throw err;
  }
}

exports.initWebApp = function(options) {

  var dashboard = options.dashboard;

	dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
		if (type !== 'http' && type !== 'https') return;
    if (!dirtyCheck.http_options) return;
    var http_options = dirtyCheck.http_options;
    var http_body = dirtyCheck.http_body;
    try {
      var options = yaml.safeLoad(dirtyCheck.http_options);
      checkDocument.setPollerParam('http_options', options);
    } catch (e) {
      if (e instanceof YAMLException) {
        throw new Error('Malformed YAML configuration ' + dirtyCheck.http_options);
      } else throw e;
    }
    if (options.keyPath && options.certPath) {
      validateFilePath(options.keyPath);
      validateFilePath(options.certPath);
    }
    checkDocument.setPollerParam('http_body', http_body);
	});

  dashboard.on('checkEdit', function(type, check, partial) {
    if (type !== 'http' && type !== 'https') return;
    check.http_options = '';
    check.http_body = '';
    var options = check.getPollerParam('http_options');
    if (options) {
      try {
        options = yaml.safeDump(options);
      } catch (e) {
        if (e instanceof YAMLException) {
          throw new Error('Malformed HTTP options');
        } else throw e;
      }
      check.setPollerParam('http_options', options);
    }
    var http_body = check.getPollerParam('http_body');
    if (http_body) {
      check.setPollerParam('http_body', http_body);
    }
    partial.push(ejs.render(template, { check: check }));
  });

  options.app.use(express.static(__dirname + '/public'));

};

exports.initMonitor = function(options) {

  options.monitor.on('pollerCreated', function(poller, check, details) {
    if (check.type !== 'http' && check.type !== 'https') return;
    var options = check.pollerParams && check.pollerParams.http_options;
    var http_body = check.pollerParams && check.pollerParams.http_body;
    if (!options) return;
    // add the custom options to the poller target
    for (var key in options) {
      poller.target[key] = options[key];
    }
    poller.http_body = http_body;
    return;
  });

};
