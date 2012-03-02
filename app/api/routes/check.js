/**
 * Module dependencies.
 */

var Check            = require('../../../models/check');
var CheckHourlyStat  = require('../../../models/checkHourlyStat');
var CheckDailyStat   = require('../../../models/checkDailyStat');
var CheckMonthlyStat = require('../../../models/checkMonthlyStat');

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/check', function(req, res) {
    Check.byUptime().find({}).asc('isUp').desc('lastChanged').exclude('qosPerHour').run(function(err, checks) {
      res.json(checks);
    });
  });

  app.get('/check/tag/:name', function(req, res, next) {
    Check.find({ tags: req.params.name }).exclude('qosPerHour').find(function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    });
  });
  
  app.get('/check/:id', function(req, res, next) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      res.json(check);
    });
  });

  app.get('/check/:id/stat/:page?', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      CheckHourlyStat.find({ check: check }).desc('timestamp').limit(50).skip(req.params.page * 50).run(function(err, stats) {
        if (err) return next(err);
        if (!stats) return next(new Error('failed to load stats for check ' + req.params.id));
        res.json(stats);
      })
    });
  });

  app.get('/check/:id/hourlyUptime', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      var uptimes = [];
      CheckHourlyStat.find({ check: check, timestamp: { $gte: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }).asc('timestamp').each(function(err, stat) {
        if (err) return next(err);
        if (stat) {
          uptimes.push([Date.parse(stat.timestamp), (stat.ups / stat.count).toFixed(5) * 100]);
        } else {
          res.json(uptimes);
        }
      })
    });
  });

  app.get('/check/:id/hourlyResponseTime', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      var responseTimes = [];
      CheckHourlyStat.find({ check: check, timestamp: { $gte: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }).asc('timestamp').each(function(err, stat) {
        if (err) return next(err);
        if (stat) {
          responseTimes.push([Date.parse(stat.timestamp), Math.round(stat.time / stat.count)]);
        } else {
          res.json(responseTimes);
        }
      })
    });
  });

  app.get('/check/:id/dailyUptime', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      var uptimes = [];
      CheckDailyStat.find({ check: check, timestamp: { $gte: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000) } }).asc('timestamp').each(function(err, stat) {
        if (err) return next(err);
        if (stat) {
          uptimes.push([Date.parse(stat.timestamp), (stat.ups / stat.count).toFixed(5) * 100]);
        } else {
          res.json(uptimes);
        }
      })
    });
  });

  app.get('/check/:id/dailyResponseTime', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      var responseTimes = [];
      CheckDailyStat.find({ check: check, timestamp: { $gte: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000) } }).asc('timestamp').each(function(err, stat) {
        if (err) return next(err);
        if (stat) {
          responseTimes.push([Date.parse(stat.timestamp), Math.round(stat.time / stat.count)]);
        } else {
          res.json(responseTimes);
        }
      })
    });
  });

  app.get('/check/:id/monthlyUptime', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      var uptimes = [];
      CheckMonthlyStat.find({ check: check, timestamp: { $gte: new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000) } }).asc('timestamp').each(function(err, stat) {
        if (err) return next(err);
        if (stat) {
          uptimes.push([Date.parse(stat.timestamp), (stat.ups / stat.count).toFixed(5) * 100]);
        } else {
          res.json(uptimes);
        }
      })
    });
  });

  app.get('/check/:id/monthlyResponseTime', function(req, res) {
    Check.find({ _id: req.params.id }).exclude('qosPerHour').findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      var responseTimes = [];
      CheckMonthlyStat.find({ check: check, timestamp: { $gte: new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000) } }).asc('timestamp').each(function(err, stat) {
        if (err) return next(err);
        if (stat) {
          responseTimes.push([Date.parse(stat.timestamp), Math.round(stat.time / stat.count)]);
        } else {
          res.json(responseTimes);
        }
      })
    });
  });
};