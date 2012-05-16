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
  
  app.get('/tag', function(req, res) {
    Tag.find({}).asc('name').exclude('qosPerHour').run(function(err, tags) {
      res.json(tags);
    });
  });

  // tag route middleware
  var loadTag = function(req, res, next) {
    Tag.find({ name: req.params.name }).findOne(function(err, tag) {
      if (err) return next(err);
      if (!tag) return next(new Error('failed to load tag ' + req.params.name));
      req.tag = tag;
      next();
    });
  }
  
  app.get('/tag/:name', loadTag, function(req, res, next) {
    res.json(req.tag);
  });

  app.get('/tag/:name/months', loadTag, function(req, res, next) {
    req.tag.getMonths(function(err, months) {
      if (err) return next(err);
      res.json(months);
    })
  });

  app.get('/tag/:name/stat/:period/:timestamp', loadTag, function(req, res, next) {
    req.tag.getSingleStatsForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function(err, stat) {
      if(err) return next(err);
      res.json(stat);
    });
  });

  app.get('/tag/:name/stats/:type/:page?', loadTag, function(req, res, next) {
    req.tag.getStatsForPeriod(req.params.type, req.params.page, function(stats) {
      res.json(stats);
    });
  });

  app.get('/tag/:name/events', function(req, res) {
    CheckEvent.find({ tags: req.params.name, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)} }).desc('timestamp').exclude('tags').run(function(err, events) {
      if (err) return next(err);
      CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
        res.json(aggregatedEvents);
      });
    });
  });

};