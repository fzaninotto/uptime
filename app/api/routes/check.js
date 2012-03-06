/**
 * Module dependencies.
 */

var Check            = require('../../../models/check');
var CheckEvent       = require('../../../models/checkEvent');
var CheckHourlyStat  = require('../../../models/checkHourlyStat');
var CheckDailyStat   = require('../../../models/checkDailyStat');
var CheckMonthlyStat = require('../../../models/checkMonthlyStat');

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/check', function(req, res) {
    Check.find({}).asc('isUp').desc('lastChanged').exclude('qosPerHour').run(function(err, checks) {
      res.json(checks);
    });
  });

  app.get('/check/count', function(req, res) {
    Check.find({}).count(function(err, count) {
      res.json(count);
    });
  });

  app.get('/check/tag/:name', function(req, res, next) {
    Check.find({ tags: req.params.name }).asc('isUp').desc('lastChanged').exclude('qosPerHour').find(function(err, checks) {
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

  app.get('/check/:id/stats/:type/:page?', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      check.getStatsForPeriod(req.params.type, req.params.page, function(stats) {
        res.json(stats);
      });
    });
  });
  
  app.get('/check/:id/events', function(req, res) {
    CheckEvent.find({ check: req.params.id, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)} }).desc('timestamp').populate('check').run(function(err, events) {
      if (err) return next(err);
      res.json(CheckEvent.aggregateEventsByDay(events));
    });
  });

};