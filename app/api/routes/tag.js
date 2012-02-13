/**
 * Module dependencies.
 */

var Tag           = require('../../../models/tag');
var TagHourlyStat = require('../../../models/tagHourlyStat');

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

  app.get('/tag/:name/hourlyUptime', function(req, res, next) {
    var uptimes = [];
    TagHourlyStat.find({ name: req.params.name, timestamp: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } }).asc('timestamp').each(function(err, stat) {
      if (err) return next(err);
      if (stat) {
        uptimes.push([Date.parse(stat.timestamp), (stat.ups / stat.count).toFixed(5) * 100]);
      } else {
        res.json(uptimes);
      }
    });
  });

  app.get('/tag/:name/hourlyResponseTime', function(req, res, next) {
    var responseTimes = [];
    TagHourlyStat.find({ name: req.params.name, timestamp: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } }).asc('timestamp').each(function(err, stat) {
      if (err) return next(err);
      if (stat) {
        responseTimes.push([Date.parse(stat.timestamp), Math.round(stat.time / stat.count)]);
      } else {
        res.json(responseTimes);
      }
    });
  });

};