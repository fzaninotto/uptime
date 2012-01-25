/**
 * Module dependencies.
 */

var Check           = require('../../../models/check');
var CheckHourlyStat = require('../../../models/checkHourlyStat');

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/check', function(req, res) {
    Check.byUptime().find({}).asc('isUp').desc('lastChanged').exclude('qosPerHour').run(function(err, checks) {
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

  app.get('/check/:name/stat', function(req, res) {
    Check.find({ name: req.params.name }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.name));
      CheckHourlyStat.find({ check: check }).asc('timestamp').run(function(err, stats) {
        if (err) return next(err);
        if (!stats) return next(new Error('failed to load stats for check ' + req.params.name));
        res.json(stats);
      })
    });
  });

};