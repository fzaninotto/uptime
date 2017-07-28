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
 *     # - ./plugins/httpAuth
 *
 * Usage
 * -----
 * Add the custom request into the 3rd API for access token using below field:
 *  AuthUrl - url of auth API,
 *  AuthHttpBody - JSON data which needs to be send during the authentication process
 *  AuthHTTPHeaders - HTTP headers in YAML format which needs to be send during the authentication process
 *
 * Into the HttpOptions you should add a placeholder into the specific HTTP header where access token should be present.
 * Example below:
 *
 * HTTP Options:
 *      method: GET
 *      headers:
 *          "Content-Type": application/json
 *           Authorization: "Bearer @access_token@"
 *
 * Auth Url:
 *      https://api.example.com/oauth/token
 *
 * Auth HTTP Body:
 *      {"grant_type":"client_credentials","scope":"public"}
 *
 * Auth HTTP Headers:
 *      "Content-Type": application/json
 *      Authorization: Basic SuperSecurityToken
 *
 *
 * When Uptime polls a HTTP or HTTPS check, the custom options override
 * the ClientRequest options.
 */

var Check = require('../../models/check');
var request = require('sync-request');
var fs = require('fs');
var ejs = require('ejs');
var yaml = require('js-yaml');
var xml2js = require('xml2js');
var express = require('express');

var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');


exports.initWebApp = function (options) {

    var dashboard = options.dashboard;

    dashboard.on('populateFromDirtyCheck', function (checkDocument, dirtyCheck, type) {
        if (type !== 'http' && type !== 'https') return;
        if (!dirtyCheck.http_auth_url || !dirtyCheck.http_auth_headers || !dirtyCheck.http_options) return;

        var http_auth_url = dirtyCheck.http_auth_url;
        var http_auth_body = dirtyCheck.http_auth_body;
        var http_auth_headers = yaml.safeLoad(dirtyCheck.http_auth_headers);
        var http_options = yaml.safeLoad(dirtyCheck.http_options);

        checkDocument.setPollerParam('http_options', http_options);
        checkDocument.setPollerParam('http_auth_url', http_auth_url);
        checkDocument.setPollerParam('http_auth_body', http_auth_body);
        checkDocument.setPollerParam('http_auth_headers', http_auth_headers);
    });

    dashboard.on('checkEdit', function (type, check, partial) {
        if (type !== 'http' && type !== 'https') return;

        var http_auth_url = check.getPollerParam('http_auth_url');
        if (http_auth_url) {
            check.setPollerParam('http_auth_url', http_auth_url);
        }

        var http_auth_body = check.getPollerParam('http_auth_body');
        if (http_auth_body)
            check.setPollerParam('http_auth_body', http_auth_body);

        var http_auth_headers = check.getPollerParam('http_auth_headers');
        if (http_auth_headers) {
            http_auth_headers = yaml.safeDump(http_auth_headers);
            check.setPollerParam('http_auth_headers', http_auth_headers);
        }

        var http_options = check.getPollerParam('http_options');
        if (http_options) {
            http_options = yaml.safeDump(http_options);
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

        var plugin_config = loadPluginConfig(http_auth_url, config);
        var placeholderValues = check.placeHolderValues;
        if (!isAccessTokenValid(check, 'expires_on'))
            placeholderValues = updatePlaceHolderValues(check, http_auth_url, http_auth_body, http_auth_headers, plugin_config);
        replacePlaceholders(poller, http_options, plugin_config.placeholders, placeholderValues);
    });
};

function loadPluginConfig(auth_url, config) {
    /**
     * Loads a plugin config based on provided url.
     */

    for (var checkName in config.checks) {
        if (config.checks.hasOwnProperty(checkName)) {
            var plugin = config.checks[checkName];
            if (auth_url.indexOf(plugin.host) !== -1) {
                return plugin;
            }
        }
    }
    return null;
}

function isAccessTokenValid(check, expiresOnKey) {
    /**
     * Checks if access token is valid.
     * @return Bool
     */

    if (check.placeHolderValues && check.placeHolderValues[expiresOnKey]) {
        var expiresOn = new Date(new Date(check.placeHolderValues._updated).getTime() + check.placeHolderValues[expiresOnKey] * 1000);
        return expiresOn > Date.now();
    } else
        return false;
}

function updatePlaceHolderValues(check, auth_url, auth_body, auth_headers, config) {
    /**
     * Loads access token from 3rd API. This function needs to be a synchronized instead of async.
     * @return string access token
     */

    var response = request('POST', auth_url, {
        body: auth_body,
        headers: auth_headers
    });

    var placeholderValues = serializeResponse(response, config);
    updateCheckPlaceHoldersInDB(check._id, placeholderValues);
    return placeholderValues;
}

function serializeResponse(response, config) {
    // extractProperty function() could be replace with built-in eval()
    // TODO: measure performance difference between extractProperty() vs eval()
    var extractProperty = function (item, prop_selector) {
        var value = item;

        prop_selector.split('.').some(function (prop) {
            value = value[prop];
            if (Array.isArray(value)) value = value[0];
            // break some() loop if value is undefined
            if (!value) return true;
        });
        return value;
    }, isContentType = function (resp, contentType) {
        return resp.headers["content-type"].toLowerCase().indexOf(contentType) !== -1;
    };
    var resp_data = {};
    if (isContentType(response, 'xml'))
        xml2js.parseString(response.getBody('utf-8'), function(err, result) {resp_data = result});
    else if (isContentType(response, 'json'))
        resp_data = JSON.parse(response.getBody('utf-8'));
    else
        console.log("Response Content-Type is not supported: ", response.headers["content-type"]);

    var fields = config.auth_resp_selectors,
        result = {};
    for (var field in fields) {
        result[field] = extractProperty(resp_data, fields[field]);
    }
    result['_updated'] = new Date();
    return result;
}

function updateCheckPlaceHoldersInDB(checkId, placeholderValues) {
    Check.findOne({_id: checkId}, function (err, check) {
        if (err) console.error(err);
        if (!check) console.error('Failed to load check with id ' + checkId);
        check.placeHolderValues = placeholderValues;
        check.save(function (saveErr) {
            if (saveErr) console.error(saveErr);
        });
    });
}

function replacePlaceholders(poller, http_options, placeholders_map, placeholderValues) {
    /**
     * Updates an origin headers and request body where place holder exists.
     */

    var http_headers = http_options.headers;

    for (var ph_key in placeholders_map) {
        var placeholder = placeholders_map[ph_key],
            value = placeholderValues[ph_key] || '';
        for (var http_header in http_headers) {
            var header_value = http_headers[http_header];
            if (header_value.indexOf(placeholder) !== -1)
                header_value = header_value.replace(placeholder, value);
            poller.target.headers[http_header] = header_value;
        }
        poller.http_body = poller.http_body.replace(placeholder, value);
    }
}

