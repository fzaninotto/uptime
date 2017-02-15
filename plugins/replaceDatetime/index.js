var fs   = require('fs');
var ejs  = require('ejs');
var express = require('express');
var dateutil  = require('dateutil');
var url  = require('url');

/* function to allow in the template */
var dateformat = function(format) {
    return dateutil.format(new Date(), format);
}

/* simplified templating function */
var render_all = function(source, decode=false) {
    if (decode) {
        source = decodeURI(source);
    }
    return ejs.render(source, {dateformat: dateformat}, {delimiter: '$'});
}

exports.initWebApp = function(options) {
    var dashboard = options.dashboard;

    dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
        console.log('populateFromDirtyCheck');
        console.log( checkDocument, dirtyCheck, type);
        if (type !== 'http' && type !== 'https') return;
        var body = dirtyCheck.http_body;
        if (body) {
            try {
                render_all(body);
            } catch (e) {
                throw new Error('Malformed post body for ejs: ' + e.message);
            }
        }
        var href = dirtyCheck.url;
        if (href) {
            try {
                render_all(href, true);
            } catch (e) {
                throw new Error('Malformed query string for ejs: ' + e.message);
            }
        }
    });
};

exports.initMonitor = function(options) {

  options.monitor.on('pollerCreated', function(poller, check, details) {
    if (check.type !== 'http' && check.type !== 'https') return;
    if (poller.http_body) {
        try {
            poller.http_body = render_all(poller.http_body);
            console.log(poller.http_body);
        } catch(e) {
            console.log(e);
        }
    }
    var href = poller.target.href; 
    href = render_all(href, true);
    Object.assign(poller.target, url.parse(href));
    console.log(poller.target.href);
    return;
  });

};