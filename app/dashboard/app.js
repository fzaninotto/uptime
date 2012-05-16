/**
 * Module dependencies.
 */
var express = require('express');
var async = require('async');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');
var TimeCalculator = require('../../lib/timeCalculator');

var app = module.exports = express.createServer();

// middleware

app.configure(function(){
  app.use(app.router);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

app.helpers({
  renderCssTags: function (all) {
    if (all != undefined) {
      return all.map(function(css) {
        return '<link rel="stylesheet" href="' + app.route + '/stylesheets/' + css + '">';
      }).join('\n ');
    } else {
      return '';
    }
  }
});

app.dynamicHelpers({
  addedCss: function(req, res) {
    return [];
  },
  route: function() {
    return app.route;
  }
});

// Routes

app.get('/events', function(req, res) {
  res.render('events');
});

app.get('/checks', function(req, res) {
  res.render('checks', { info: req.flash('info')  });
});

app.get('/check', function(req, res) {
  res.render('check_new', { check: new Check(), info: req.flash('info') });
});

app.post('/check', function(req, res) {
  var check = new Check(req.body.check);
  check.tags = Check.convertTags(req.body.check.tags);
  check.interval = req.body.check.interval * 1000;
  check.type = Check.guessType(check.url);
  check.save(function(err) {
    req.flash('info', 'New check has been created');
    res.redirect(req.body.saveandadd ? '/check' : ('/check/' + check._id));
  });
});

app.get('/check/:id', function(req, res, next) {
  Check.findOne({ _id: req.params.id }, function(err, check) {
    if (err) return next(err);
    if (!check) return next(new Error('failed to load check ' + req.params.id));
    res.render('check', { check: check, info: req.flash('info') });
  });
});

app.put('/check/:id', function(req, res, next) {
  var check = req.body.check;
  check.tags = Check.convertTags(check.tags);
  check.interval = req.body.check.interval * 1000;
  check.type = Check.guessType(check.url);
  Check.update({ _id: req.params.id }, { $set: check }, { upsert: true }, function(err) {
    if (err) return next(err);
    req.flash('info', 'Changes have been saved');
    res.redirect('/check/' + req.params.id);
  });
});

app.delete('/check/:id', function(req, res, next) {
  Check.findOne({ _id: req.params.id }, function(err, check) {
    if (err) return next(err);
    if (!check) return next(new Error('failed to load check ' + req.params.id));
    check.remove(function(err){
      req.flash('info', 'Check has been deleted');
      res.redirect('/checks');
    });
  });
});

app.get('/tags', function(req, res) {
  res.render('tags');
});

app.get('/tag/:name', function(req, res, next) {
  Tag.findOne({ name: req.params.name }, function(err, tag) {
    if (err) return next(err);
    if (!tag) return next(new Error('failed to load tag ' + req.params.name));
    res.render('tag', { tag: tag });
  });
});

app.get('/tag/:name/report/:date', function(req, res, next) {
  var date = parseInt(req.params.date);
  var begin = TimeCalculator.resetMonth(date);
  var end = TimeCalculator.completeMonth(date);
  async.parallel({
    tag: function(callback) {
      Tag.findOne({ name: req.params.name }, callback)
    },
    tagStats: function(callback) {
      TagDailyStat.find({ name: req.params.name, timestamp: { $gte: begin, $lte: end }}).asc('timestamp').run(callback);
    },
    checkStats: function(callback) {
      Check.find({ tags: req.params.name }).run(function(getCheckErr, checks) {
        CheckMonthlyStat.find({ check: { $in: checks }, timestamp: { $gte: begin, $lte: end }}).desc('downtime').populate('check', ['name']).run(callback);
      });
    }
  }, function(err, results) {
    if (err) return next(err);
    res.render('tagReport', { tag: results.tag, begin: begin, end: end, tagStats: results.tagStats, checkStats: results.checkStats });
  });
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}