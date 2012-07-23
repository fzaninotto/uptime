/**
 * Module dependencies.
 */

var Check      = require('../../../models/check');
var CheckEvent = require('../../../models/checkEvent');
var Ping       = require('../../../models/ping');

/**
 * Check Routes
 */
module.exports = function(app) {
  
  app.get('/pings/check/:id/:page?', function(req, res, next) {
    Check.count({ _id: req.params.id, owner: req.user.id}, function(err, nb_checks) {
      if (err) return app.next(err);
      if (!nb_checks) return app.next(new Error('failed to load check ' + req.params.id));
      Ping.find({ check: req.params.id }).desc('timestamp').limit(50).skip((req.params.page -1) * 50).run(function(err, pings) {
        if (err) return next(err);
        res.json(pings);
      });
    });
  });

  app.get('/pings/events', function(req, res, next) {
    if (req.user == null) return res.send('Not authorized', 401);
    var ids = new Array();
    Check.find({owner: req.user.id}, function(e, docs){
      for (d in docs) {
        ids.push(docs[d]._id);
      }
      CheckEvent.find({check:{$in: ids}, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)} }).desc('timestamp').exclude('tags').run(function(err, events) {
        if (err) return next(err);
        CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
          res.json(aggregatedEvents);
        });
      });
    });
  });

  app.post('/pings', function(req, res) {
    // TODO: split from web API
    Check.findById(req.body.checkId, function(err1, check) {

      if (err1) {
        return res.send(err1.message, 500);
      };
      if (!check) {
        return rest.send('Error: No existing check with id ' + req.body.checkId, 403);
      };
      if (!check.needsPoll) {
        return res.send('Error: This check was already polled. No ping was created', 403);
      };
      var status = req.body.status === 'true';
      Ping.createForCheck(status, req.body.time, check, req.body.name, req.body.error, function(err2, ping) {
        if (err2) {
          return res.send(err2.message, 500);
        }
        res.json(ping);
      });
    })
  });

};