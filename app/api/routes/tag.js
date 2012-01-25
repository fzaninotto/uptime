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

  app.get('/tag/:name/stat', function(req, res, next) {
    TagHourlyStat.find({ name: req.params.name }).asc('timestamp').run(function(err, stats) {
      if (err) return next(err);
      if (!stats) return next(new Error('failed to load stats for tag ' + req.params.name));
      res.json(stats);
    });
  });

};