/**
 * JSON Validator Plugin
 */
var fs   = require('fs');
var ejs  = require('ejs');
var util = require('util');
var Validator = require('jsonschema').Validator;


var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');

exports.initWebApp = function(options) {

    var dashboard = options.dashboard;

    dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
        if (type !== 'http' && type !== 'https') return;
        var match = dirtyCheck.jschema;
        if (match=='') {
            checkDocument.setPollerParam('jschema', match);
            return;
        }
        try {
            JSON.parse(match);
        } catch (e) {
            throw new Error('Malformed JSON Schema ');
        }
        checkDocument.setPollerParam('jschema', match);
    });

    dashboard.on('checkEdit', function(type, check, partial) {
        if (type !== 'http' && type !== 'https') return;
        check.jschema = '';
        var options = check.getPollerParam('jschema');
        check.setPollerParam('jschema', options);
        partial.push(ejs.render(template, { check: check }));
    });

};

exports.initMonitor = function(options) {

    options.monitor.on('pollerPolled', function(check, res, details) {
        if (check.type !== 'http' && check.type !== 'https') return;
        var jschema = check.pollerParams && check.pollerParams.jschema;
        if (!jschema) return;
        var v = new Validator();

        try {
            jsonData=JSON.parse(res.body);
        } catch (e) {
            throw new Error('JSON File isn\'t json');
        }
        try {
            jschema=JSON.parse(jschema);
        } catch (e) {
            throw new Error('JSON Schema isn\'t valide');
        }

        result=v.validate(jsonData, jschema);

        if(result.valid){
            return;
        }else{
            throw new Error(result);
        }
        return;

        try {
            jsonData=JSON.parse(res.body);
        } catch (e) {
            throw new Error('Malformed JSON File ');
        }


    });

};
