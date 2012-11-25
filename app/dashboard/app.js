/**
 * Module dependencies.
 */
var express = require('express');
var async = require('async');
var partials = require('express-partials');
var flash = require('connect-flash');
var lessMiddleware = require('less-middleware');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');
var TimeCalculator = require('../../lib/timeCalculator');

var app = module.exports = express();

// middleware

app.configure(function(){
  app.use(partials());
  app.use(express.cookieParser('uptime secret string'));
  app.use(express.session({ cookie: { maxAge: 60000 }}));
  app.use(flash());
  app.use(function locals(req, res, next) {
    res.locals.route = app.route;
    res.locals.renderCssTags = function (all) {
      if (all != undefined) {
        return all.map(function(css) {
          return '<link rel="stylesheet" href="' + app.route + '/stylesheets/' + css + '">';
        }).join('\n ');
      } else {
        return '';
      }
    }
    res.locals.moment = require('./public/javascripts/moment.min.js');
    next();
  });
  app.use(app.router);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(lessMiddleware({src: __dirname + '/public/less', dest: __dirname + '/public/stylesheets', prefix:"/stylesheets", compress: false, force: true, debug: true}));
});

app.configure('production', function(){
  app.use(express.errorHandler());
  app.use(lessMiddleware({src: __dirname + '/public/less', dest: __dirname + '/public/stylesheets', prefix:"/stylesheets", compress: true, once: true, debug: false}));
});

app.locals({
  addedCss: []
});

// Routes

app.get('/events', function(req, res) {
  res.render('events');
});

app.get('/checks', function(req, res) {
  res.render('checks', { info: req.flash('info') });
});

app.get('/checks/new', function(req, res) {
  res.render('check_new', { check: new Check(), info: req.flash('info') });
});

app.post('/checks', function(req, res) {
  var check = new Check(req.body.check);
  check.name = check.name || check.url;
  check.tags = Check.convertTags(req.body.check.tags);
  check.interval = req.body.check.interval * 1000;
  check.type = Check.guessType(check.url);
  check.save(function(err) {
    if (err) return next(err);
    req.flash('info', 'New check has been created');
    res.redirect(app.route + (req.body.saveandadd ? '/checks/new' : ('/checks/' + check._id + '#admintab')));
  });
});

app.get('/checks/:id', function(req, res, next) {
  Check.findOne({ _id: req.params.id }, function(err, check) {
    if (err) return next(err);
    if (!check) return res.send(404, 'failed to load check ' + req.params.id);
    res.render('check', { check: check, info: req.flash('info') });
  });
});

app.put('/checks/:id', function(req, res, next) {
  var check = req.body.check;
  check.tags = Check.convertTags(check.tags);
  check.interval = req.body.check.interval * 1000;
  check.type = Check.guessType(check.url);
  Check.update({ _id: req.params.id }, { $set: check }, { upsert: true }, function(err) {
    if (err) return next(err);
    req.flash('info', 'Changes have been saved');
    res.redirect(app.route + '/checks/' + req.params.id + '#admintab');
  });
});

app.delete('/checks/:id', function(req, res, next) {
  Check.findOne({ _id: req.params.id }, function(err, check) {
    if (err) return next(err);
    if (!check) return next(new Error('failed to load check ' + req.params.id));
    check.remove(function(err2) {
      if (err2) return next(err2);
      req.flash('info', 'Check has been deleted');
      res.redirect(app.route + '/checks');
    });
  });
});

app.get('/tags', function(req, res) {
  res.render('tags');
});

app.get('/tags/:name', function(req, res, next) {
  Tag.findOne({ name: req.params.name }, function(err, tag) {
    if (err) return next(err);
    if (!tag) return next(new Error('failed to load tag ' + req.params.name));
    res.render('tag', { tag: tag });
  });
});

app.get('/tags/:name/report/:date', function(req, res, next) {
  Tag.findOne({ name: req.params.name }, function(err, tag) {
    if (err) return next(err);
    if (!tag) return next(new Error('failed to load tag ' + req.params.name));
    tag.getMonthlyReport(parseInt(req.params.date), function (err2, report) {
      if (err2) return next(err2);
      res.render('tagReport', report);
    })
  });
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}