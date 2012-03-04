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
  
  app.get('/tag/:name', function(req, res, next) {
    Tag.find({ name: req.params.name }).exclude('qosPerHour').findOne(function(err, tag) {
      if (err) return next(err);
      if (!tag) return next(new Error('failed to load tag ' + req.params.name));
      res.json(tag);
    });
  });

  app.get('/tag/:name/stat/:page?', function(req, res, next) {
    TagHourlyStat.find({ name: req.params.name }).desc('timestamp').limit(50).skip(req.params.page * 50).run(function(err, stats) {
      if (err) return next(err);
      if (!stats) return next(new Error('failed to load stats for tag ' + req.params.name));
      res.json(stats);
    });
  });

  app.get('/tag/:name/uptime/:type', function(req, res) {
    Tag.find({ name: req.params.name }).exclude('qosPerHour').findOne(function(err, tag) {
      if (err) return next(err);
      if (!tag) return next(new Error('failed to load tag ' + req.params.name));
      tag.getUptimeForPeriod(req.params.type, function(stats) {
        res.json(stats);
      });
    });
  });

  app.get('/tag/:name/responseTime/:type', function(req, res) {
    Tag.find({ name: req.params.name }).exclude('qosPerHour').findOne(function(err, tag) {
      if (err) return next(err);
      if (!tag) return next(new Error('failed to load tag ' + req.params.name));
      tag.getResponseTimeForPeriod(req.params.type, function(stats) {
        res.json(stats);
      });
    });
  });

  app.get('/tag/:name/events', function(req, res) {
    CheckEvent.find({ tags: req.params.name, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)} }).desc('timestamp').populate('check').run(function(err, events) {
      if (err) return next(err);
      res.json(events);
    });
  });

};