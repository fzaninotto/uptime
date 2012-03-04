/**
 * Module dependencies.
 */

var Check            = require('../../../models/check');
var CheckHourlyStat  = require('../../../models/checkHourlyStat');
var CheckDailyStat   = require('../../../models/checkDailyStat');
var CheckMonthlyStat = require('../../../models/checkMonthlyStat');

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/check', function(req, res) {
    Check.byUptime().find({}).asc('isUp').desc('lastChanged').exclude('qosPerHour').run(function(err, checks) {
      res.json(checks);
    });
  });

  app.get('/check/tag/:name', function(req, res, next) {
    Check.find({ tags: req.params.name }).exclude('qosPerHour').find(function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    });
  });
  
  app.get('/check/:id', function(req, res, next) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      res.json(check);
    });
  });

  app.get('/check/:id/stat/:page?', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      CheckHourlyStat.find({ check: check }).desc('timestamp').limit(50).skip(req.params.page * 50).run(function(err, stats) {
        if (err) return next(err);
        if (!stats) return next(new Error('failed to load stats for check ' + req.params.id));
        res.json(stats);
      })
    });
  });

  app.get('/check/:id/uptime/:type', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      check.getUptimeForPeriod(req.params.type, function(stats) {
        res.json(stats);
      });
    });
  });

  app.get('/check/:id/responseTime/:type', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      check.getResponseTimeForPeriod(req.params.type, function(stats) {
        res.json(stats);
      });
    });
  });

};