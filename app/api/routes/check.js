/**
 * Module dependencies.
 */

var Check = require('../../../models/check').Check;

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/check', function(req, res) {
    Check.byUptime().find({}).run(function(err, checks) {
      res.json(checks);
    });
  });
  
  app.get('/check/:name', function(req, res) {
    Check.findOne({ name: req.params.name }, function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.name));
      res.json(check);
    });
  });
  
};