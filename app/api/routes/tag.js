/**
 * Module dependencies.
 */

var Tag           = require('../../../models/tag');
var TagHourlyStat = require('../../../models/tagHourlyStat');
var CheckEvent    = require('../../../models/checkEvent');

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/tags', function(req, res) {
    Tag
    .find()
    .sort({ name: 1 })
    .exec(function(err, tags) {
      res.json(tags);
    });
  });

  // tag route middleware
  var loadTag = function(req, res, next) {
    Tag.findOne({ name: req.params.name }, function(err, tag) {
      if (err) return next(err);
      if (!tag) return res.json(404, { error: 'failed to load tag ' + req.params.name });
      req.tag = tag;
      next();
    });
  }
  
  app.get('/tags/:name', loadTag, function(req, res, next) {
    res.json(req.tag);
  });

  app.get('/tags/:name/months', loadTag, function(req, res, next) {
    req.tag.getMonths(function(err, months) {
      if (err) return next(err);
      res.json(months);
    })
  });

  app.get('/tags/:name/stat/:period/:timestamp', loadTag, function(req, res, next) {
    req.tag.getSingleStatsForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function(err, stat) {
      if(err) return next(err);
      res.json(stat);
    });
  });

  app.get('/tags/:name/stats/:type/:page?', loadTag, function(req, res, next) {
    req.tag.getStatsForPeriod(req.params.type, req.params.page, function(err, stats) {
      if (err) return next(err);
      res.json(stats);
    });
  });

  app.get('/tags/:name/events', function(req, res) {
    CheckEvent
    .find({
      tags: req.params.name,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
    })
    .sort({ timestamp: -1 })
    .select({ tags: 0 })
    .exec(function(err, events) {
      if (err) return next(err);
      CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
        res.json(aggregatedEvents);
      });
    });
  });

};