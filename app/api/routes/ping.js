/**
 * Module dependencies.
 */

var Check = require('../../../models/check').Check,
    Ping  = require('../../../models/ping').Ping;

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/pings/check/:id', function(req, res) {
    Check.findOne({ _id: req.params.id }, function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      Ping.find({ check: check }).desc('date').limit(50).run(function(err, pings) {
        res.json(pings);
      });
    });
  });
  
};