/**
 * Module dependencies.
 */
var express = require('express');
var async = require('async');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
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
  },
  moment: require('./public/javascripts/moment.min.js')
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
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else res.render('checks', { info: req.flash('info')  });
});

app.get('/checks/new', function(req, res) {
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else res.render('check_new', { check: new Check(), info: req.flash('info') });
});

app.post('/checks', function(req, res) {
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else {
    var check = new Check(req.body.check);
    check.tags = Check.convertTags(req.body.check.tags);
    check.interval = req.body.check.interval * 1000;
    check.type = Check.guessType(check.url);
    check.save(function(err) {
      req.flash('info', 'New check has been created');
      res.redirect(req.body.saveandadd ? '/checks' : ('/checks/' + check._id + '#admintab'));
    });  
  }
});

app.get('/checks/:id', function(req, res, next) {
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else {
    Check.findOne({ _id: req.params.id }, function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      res.render('check', { check: check, info: req.flash('info') });
    });
  }
});

app.put('/checks/:id', function(req, res, next) {
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else {
    var check = req.body.check;
    check.tags = Check.convertTags(check.tags);
    check.interval = req.body.check.interval * 1000;
    check.type = Check.guessType(check.url);
    Check.update({ _id: req.params.id }, { $set: check }, { upsert: true }, function(err) {
      if (err) return next(err);
      req.flash('info', 'Changes have been saved');
      res.redirect('/checks/' + req.params.id + '#admintab');
    });
  }
});

app.delete('/checks/:id', function(req, res, next) {
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else {
    Check.findOne({ _id: req.params.id }, function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      check.remove(function(err){
        req.flash('info', 'Check has been deleted');
        res.redirect('/checks');
      });
    });
  }
});

app.get('/tags', function(req, res) {
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else res.render('tags');
});

app.get('/tags/:name', function(req, res, next) {
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else {
    Tag.findOne({ name: req.params.name }, function(err, tag) {
      if (err) return next(err);
      if (!tag) return next(new Error('failed to load tag ' + req.params.name));
      res.render('tag', { tag: tag });
    });
  }
});

app.get('/tags/:name/report/:date', function(req, res, next) {
  if (! req.isAuthenticated()) res.redirect('/login'); 
  else {
    Tag.findOne({ name: req.params.name }, function(err, tag) {
      if (err) return next(err);
      if (!tag) return next(new Error('failed to load tag ' + req.params.name));
      tag.getMonthlyReport(parseInt(req.params.date), function (err2, report) {
        if (err2) return next(err2);
        res.render('tagReport', report);
      })
    });
  }
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}