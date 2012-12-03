/**
 * Module dependencies.
 */
var express = require('express');
var async = require('async');
var partials = require('express-partials');
var flash = require('connect-flash');
var moment = require('moment');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');

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
    res.locals.moment = moment;
    next();
  });
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

app.locals({
  addedCss: []
});

// Routes

app.get('/events', function(req, res) {
  res.render('events');
});

app.get('/checks', function(req, res) {
  Check.find().sort({ isUp: 1, lastChanged: -1 }).exec(function(err, checks) {
    if (err) return next(err);
    res.render('checks', { info: req.flash('info'), checks: checks });
  });
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
    res.redirect(app.route + (req.body.saveandadd ? '/checks/new' : ('/checks/' + check._id + '?type=hour&date=' + Date.now())));
  });
});

app.get('/checks/:id', function(req, res, next) {
  Check.findOne({ _id: req.params.id }, function(err, check) {
    if (err) return next(err);
    if (!check) return res.send(404, 'failed to load check ' + req.params.id);
    res.render('check', { check: check, info: req.flash('info'), req: req });
  });
});

app.get('/checks/:id/edit', function(req, res, next) {
  Check.findOne({ _id: req.params.id }, function(err, check) {
    if (err) return next(err);
    if (!check) return res.send(404, 'failed to load check ' + req.params.id);
    res.render('check_edit', { check: check, info: req.flash('info'), req: req });
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
    res.redirect(app.route + '/checks/' + req.params.id);
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
  Tag.find().sort({ name: 1 }).exec(function(err, tags) {
    if (err) return next(err);
    res.render('tags', { tags: tags });
  });
});

app.get('/tags/:name', function(req, res, next) {
  Tag.findOne({ name: req.params.name }, function(err, tag) {
    if (err) return next(err);
    if (!tag) return next(new Error('failed to load tag ' + req.params.name));
    res.render('tag', { tag: tag, req: req });
  });
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}