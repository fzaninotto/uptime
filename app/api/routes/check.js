/**
 * Module dependencies.
 */

var Check = require('../../../models/check');

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/check', function(req, res) {
    Check.byUptime().find({}).exclude('qosPerHour').run(function(err, checks) {
      res.json(checks);
    });
  });
  
  app.get('/check/:name', function(req, res, next) {
    Check.find({ name: req.params.name }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.name));
      res.json(check);
    });
  });
  
};