/**
 * Module dependencies.
 */

var Tag = require('../../../models/tag').Tag;

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/tag', function(req, res) {
    Tag.find({}).exclude('qosPerHour').run(function(err, tags) {
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
  
};