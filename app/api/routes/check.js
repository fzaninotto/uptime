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
    Check.find({}).asc('isUp').desc('lastChanged').run(function(err, checks) {
      res.json(checks);
    });
  });

  app.get('/check/needingPoll', function(req, res) {
    Check.needingPoll().exclude('qos').run(function(err, checks) {
      res.json(checks);
    });
  });

  app.get('/check/tag/:name', function(req, res, next) {
    Check.find({ tags: req.params.name }).asc('isUp').desc('lastChanged').find(function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    });
  });

  // check route middleware
  var loadCheck = function(req, res, next) {
    Check.find({ _id: req.params.id }).exclude('qos').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      req.check = check;
      next();
    });
  }

  app.get('/check/:id', loadCheck, function(req, res, next) {
    res.json(req.check);
  });
  
  app.get('/check/:id/pause', loadCheck, function(req, res, next) {
    req.check.togglePause();
    req.check.save(function(err) {
      if (err) return next(new Error('failed to togle pause on check' + req.params.id));
      res.send();
    });
    new CheckEvent({
      timestamp: new Date(),
      check: req.check,
      tags: req.check.tags,
      message: req.check.isPaused ? 'paused' : 'restarted',
    }).save();
  });

  app.get('/check/:id/stat/:period/:timestamp', loadCheck, function(req, res, next) {
    req.check.getSingleStatsForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function(err, stat) {
      if(err) return next(err);
      res.json(stat);
    });
  });
  
  app.get('/check/:id/stats/:type/:page?', loadCheck, function(req, res, next) {
    req.check.getStatsForPeriod(req.params.type, req.params.page, function(err, stats) {
      if(err) return next(err);
      res.json(stats);
    });
  });
  
  app.get('/check/:id/events', function(req, res, next) {
    CheckEvent.find({ check: req.params.id, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)} }).desc('timestamp').exclude('tags').run(function(err, events) {
      if (err) return next(err);
      CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
        res.json(aggregatedEvents);
      });
    });
  });

};