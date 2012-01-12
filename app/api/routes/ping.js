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
    Check.count({ _id: req.params.id}, function(err, nb_checks) {
      if (err) return app.next(err);
      if (!nb_checks) return app.next(new Error('failed to load check ' + req.params.id));
      Ping.find({ check: req.params.id }).desc('date').limit(50).run(function(err, pings) {
        if (err) return next(err);
        res.json(pings);
      });
    });
  });
  
};