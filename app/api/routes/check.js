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

  app.get('/checks', function(req, res, next) {
    var query = {};
    if (req.query.tag) {
      query.tags = req.query.tag;
    }
    Check.find(query).sort({ isUp: 1, lastChanged: -1 }).exec(function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    });
  });

  app.get('/checks/needingPoll', function(req, res, next) {
    Check.needingPoll().select({qos: 0}).exec(function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    });
  });

  // check route middleware
  var loadCheck = function(req, res, next) {
    Check.find({ _id: req.params.id }).select({qos: 0}).findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      req.check = check;
      next();
    });
  }

  app.get('/checks/:id', loadCheck, function(req, res, next) {
    res.json(req.check);
  });
  
  app.get('/checks/:id/pause', loadCheck, function(req, res, next) {
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

  app.get('/checks/:id/stat/:period/:timestamp', loadCheck, function(req, res, next) {
    req.check.getSingleStatsForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function(err, stat) {
      if(err) return next(err);
      res.json(stat);
    });
  });
  
  app.get('/checks/:id/stats/:type/:page?', loadCheck, function(req, res, next) {
    req.check.getStatsForPeriod(req.params.type, req.params.page, function(err, stats) {
      if(err) return next(err);
      res.json(stats);
    });
  });
  
  app.get('/checks/:id/events', function(req, res, next) {
    CheckEvent.find({ check: req.params.id, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)} }).sort({ timestamp: -1 }).select({tags: 0}).exec(function(err, events) {
      if (err) return next(err);
      CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
        res.json(aggregatedEvents);
      });
    });
  });

};