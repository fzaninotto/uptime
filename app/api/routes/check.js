/**
 * Module dependencies.
 */

var Check            = require('../../../models/check');
var CheckEvent       = require('../../../models/checkEvent');
var CheckHourlyStat  = require('../../../models/checkHourlyStat');
var CheckDailyStat   = require('../../../models/checkDailyStat');
var CheckMonthlyStat = require('../../../models/checkMonthlyStat');

/**
 * Check Routes
 */
module.exports = function(app) {

  app.get('/checks', function(req, res, next) {
    var query = {};
    if (req.query.tag) {
      query.tags = req.query.tag;
    }
    Check
    .find(query)
    .sort({ isUp: 1, lastChanged: -1 })
    .exec(function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    });
  });

  app.get('/checks/needingPoll', function(req, res, next) {
    Check
    .needingPoll()
    .select({qos: 0})
    .exec(function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    });
  });

  // check route middleware
  var loadCheck = function(req, res, next) {
    Check
    .find({ _id: req.params.id })
    .select({qos: 0})
    .findOne(function(err, check) {
      if (err) return next(err);
      if (!check) return res.json(404, { error: 'failed to load check ' + req.params.id });
      req.check = check;
      next();
    });
  };

  app.get('/checks/:id', loadCheck, function(req, res, next) {
    res.json(req.check);
  });
  
  app.get('/checks/:id/pause', loadCheck, function(req, res, next) {
    req.check.togglePause();
    req.check.save(function(err) {
      if (err) return next(new Error('failed to toggle pause on check' + req.params.id));
      new CheckEvent({
        timestamp: new Date(),
        check: req.check,
        tags: req.check.tags,
        message: req.check.isPaused ? 'paused' : 'restarted'
      }).save();
      res.redirect(app.route + '/checks/' + req.params.id);
    });
  });

  app.put('/check/:id/test', function (req, res, next) {
    Check.update({ _id: req.params.id }, { lastTested: new Date() }, function(err, numberAffected) {
      if (err) return next(err);
      res.json({ numberAffected: numberAffected });
    });
  });

  app.get('/checks/:id/stat/:period/:timestamp', loadCheck, function(req, res, next) {
    req.check.getSingleStatForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function(err, stat) {
      if (err) return next(err);
      res.json(stat);
    });
  });
  
  app.get('/checks/:id/stats/:type', loadCheck, function(req, res, next) {
    req.check.getStatsForPeriod(req.params.type, req.query.begin, req.query.end, function(err, stats) {
      if(err) return next(err);
      res.json(stats);
    });
  });
  
  app.get('/checks/:id/events', function(req, res, next) {
    var query = {
      check: req.params.id,
      timestamp: { $gte: req.query.begin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    };
    if (req.query.end) {
      query.timestamp.$lte = req.query.end;
    }
    CheckEvent
    .find(query)
    .sort({ timestamp: -1 })
    .select({tags: 0})
    .limit(100)
    .exec(function(err, events) {
      if (err) return next(err);
      CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
        if(err) return next(err);
        res.json(aggregatedEvents);
      });
    });
  });

 app.put('/checks', function(req, res, next) {
   var check = new Check();
   try {
     check.populateFromDirtyCheck(req.body, app.get('pollerCollection'));
     app.emit('populateFromDirtyCheck', check, req.body, check.type);
   } catch (checkException) {
     return next(checkException);
   }
   check.save(function(saveError) {
     if(saveError) return next({status:500, error: saveError});
     res.json(check);
   });
 });

 app.delete('/checks/:id', loadCheck, function (req, res, next) {
  req.check.remove(function(err) {
    if (err) return next(err);
    res.end();
  });
 });

 app.post('/checks/:id', function(req, res, next) {
   Check.findOne({ _id: req.params.id }, function(err, check) {
     if (err) return next({status:500, error: err});
     if (!check) return next({status:404, error: 'failed to load check ' + req.params.id})

     try {
       check.populateFromDirtyCheck(req.body, app.get('pollerCollection'));
       app.emit('populateFromDirtyCheck', check, req.body, check.type);
     } catch (checkException) {
       return next(checkException);
     }
     check.save(function(saveError) {
       if(saveError) return next({status:500, error: saveError});
       res.json(check);
     });
   });
 });
};
