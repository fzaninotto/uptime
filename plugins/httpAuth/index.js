/**
 * HTTP Auth plugin
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
 * Add the custom HTTP/HTTPS options in the 'HTTP Auth' textarea displayed
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

var Check = require('../../models/check');
var request = require('sync-request');
var fs = require('fs');
var ejs = require('ejs');
var yaml = require('js-yaml');
var express = require('express');

var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');


exports.initWebApp = function (options) {

    var dashboard = options.dashboard;

    dashboard.on('populateFromDirtyCheck', function (checkDocument, dirtyCheck, type) {
        if (type !== 'http' && type !== 'https') return;
        if (!dirtyCheck.http_auth_url) return;
        var http_auth_url = dirtyCheck.http_auth_url;
        var http_auth_body = dirtyCheck.http_auth_body;

        if (!dirtyCheck.http_auth_headers) return;
        var http_auth_headers = loadYamlValue(dirtyCheck.http_auth_headers);

        if (!dirtyCheck.http_options) return;
        var http_options = loadYamlValue(dirtyCheck.http_options);

        checkDocument.setPollerParam('http_options', http_options);
        checkDocument.setPollerParam('http_auth_url', http_auth_url);
        checkDocument.setPollerParam('http_auth_body', http_auth_body);
        checkDocument.setPollerParam('http_auth_headers', http_auth_headers);
    });

    dashboard.on('checkEdit', function (type, check, partial) {
        if (type !== 'http' && type !== 'https') return;
        check.http_auth_url = '';
        check.http_auth_body = '';
        check.http_auth_headers = '';
        check.http_options = '';

        var http_auth_url = check.getPollerParam('http_auth_url');
        if (http_auth_url) {
            check.setPollerParam('http_auth_url', http_auth_url);
        }

        var http_auth_body = check.getPollerParam('http_auth_body');
        if (http_auth_body) {
            http_auth_body = JSON.parse(http_auth_body);
            check.setPollerParam('http_auth_body', http_auth_body);
        }

        var http_auth_headers = check.getPollerParam('http_auth_headers');
        if (http_auth_headers) {
            http_auth_headers = dumpYamlValue(http_auth_headers);
            check.setPollerParam('http_auth_headers', http_auth_headers);
        }

        var http_options = check.getPollerParam('http_options');
        if (http_options) {
            http_options = dumpYamlValue(http_options);
            check.setPollerParam('http_options', http_options);
        }

        partial.push(ejs.render(template, {check: check}));
    });

    options.app.use(express.static(__dirname + '/public'));

};

exports.initMonitor = function (options) {
    var config = options.config.httpAuth;

    options.monitor.on('pollerCreated', function (poller, check, details) {
        if (check.type !== 'http' && check.type !== 'https') return;
        var http_auth_url = check.pollerParams && check.pollerParams.http_auth_url;
        var http_auth_body = check.pollerParams && check.pollerParams.http_auth_body;
        var http_auth_headers = check.pollerParams && check.pollerParams.http_auth_headers;
        var http_options = check.pollerParams && check.pollerParams.http_options;

        if (!http_auth_url) return;

        console.log('url: ' + http_auth_url);
        console.log('headers: ' + http_auth_headers);
        console.log('post body: ' + http_auth_body);
        console.log('check._id: ' + check._id);

        var plugin_config = loadPluginConfig(http_auth_url, config);
        console.log('plugin config: ' + plugin_config);

        var access_token = loadAccessTokenFromDB(check);
        if (!access_token)
            access_token = loadAndUpdateAccessToken(check, http_auth_url, http_auth_body, http_auth_headers, plugin_config);

        updateOriginHeaders(access_token, http_options, poller, plugin_config);
        console.log('---------------------------');
        console.log(poller.target);
        console.log('---------------------------');
    });
};

function loadYamlValue(value) {
    try {
        return yaml.safeLoad(value);
    } catch (e) {
        throw e;
    }
}

function dumpYamlValue(value) {
    try {
        return yaml.safeDump(value);
    } catch (e) {
        throw e;
    }
}

function loadPluginConfig(auth_url, config) {
    /**
     * Loads a plugin config based on provided url.
     */

    for (var pluginName in config.plugins) {
        var plugin = config.plugins[pluginName];
        if (auth_url.indexOf(plugin.host) !== -1) {
            return plugin;
        }
    }
    return null;
}

function loadAccessTokenFromDB(check) {
    /**
     * Loads access token from database based on Check ID.
     * @return string access token
     */

    var access_token = null;
    var is_token_valid = new Date(check.access_token['expires_on']).getTime() > Date.now();

    if (typeof check.access_token !== 'undefined' && check.access_token && is_token_valid) {
        access_token = check.access_token['access_token'];

        console.log('access_token: ' + JSON.stringify(access_token));
        console.log('Access token was loaded from the db');
    }
    return access_token;
}

function loadAndUpdateAccessToken(check, auth_url, auth_body, auth_headers, config) {
    /**
     * Loads access token from 3rd API. This function needs to be a synchronized instead of async.
     * @return string access token
     */

    var response = request('POST', auth_url, {
        json: JSON.parse(auth_body),
        headers: auth_headers
    });

    var resp = serializeResponse(JSON.parse(response.getBody('utf-8')), config);
    console.log('serialized_resp: ' + JSON.stringify(resp));

    console.log('access_token: ' + resp['access_token']);
    console.log('expires_in: ' + resp['expires_in']);

    var expires_on = new Date(new Date().getTime() + resp['expires_in'] * 1000);
    console.log('expires_on: ' + expires_on);

    // Updates check model in db...
    Check.findOne({_id: check._id}, function (err, _check) {
        if (err) console.error(err);
        if (!check) console.error('Failed to load check with id ' + check._id);

        _check.access_token = {
            'access_token': resp['access_token'],
            'expires_on': expires_on
        };
        _check.save(function (saveErr) {
            if (saveErr) console.error(saveErr);
            console.log('Check with id ' + check._id + ' was saved');
        });
    });
    console.log('Access token was fetched from the 3rd API and saved into the db');

    return resp['access_token'];
}

function serializeResponse(json_resp, config) {
    var fields = config.fields_mapping;
    var resp = {};
    for (var field in fields) {
        console.log('field: ' + field);
        var mapped_field = fields[field];
        resp[field] = json_resp[mapped_field];
    }
    return resp;
}

function updateOriginHeaders(access_token, http_options, poller, config) {
    /**
     * Updates an origin headers where place holder exists.
     */

    var token_placeholder = config.access_token_placeholder;
    var http_headers = http_options.headers;

    for (var http_header in http_headers) {
        var header_value = http_headers[http_header];
        if (header_value.indexOf(token_placeholder) !== -1) {
            header_value = header_value.replace(token_placeholder, access_token);
        }
        poller.target.headers[http_header] = header_value;
    }
}

