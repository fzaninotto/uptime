/**
 * Module dependencies.
 */
var express = require('express');

var Check = require('../../models/check');
var Tag = require('../../models/tag');

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

// Routes

app.get('/events', function(req, res) {
  res.render('events', { route: app.route  });
});

app.get('/checks', function(req, res) {
  res.render('checks', { route: app.route, info: req.flash('info')  });
});

app.get('/check', function(req, res) {
  res.render('check_new', { route: app.route, check: new Check() });
});

app.post('/check', function(req, res) {
  var check = new Check(req.body.check);
  check.tags = Check.convertTags(req.body.check.tags);
  check.interval = req.body.check.interval * 1000;
  check.save(function(err) {
    req.flash('info', 'New check has been created');
    res.redirect('/check/' + check._id);
  });
});

app.get('/check/:id', function(req, res, next) {
  Check.findOne({ _id: req.params.id }, function(err, check) {
    if (err) return next(err);
    if (!check) return next(new Error('failed to load check ' + req.params.id));
    res.render('check', { route: app.route, check: check, info: req.flash('info') });
  });
});

app.put('/check/:id', function(req, res, next) {
  var check = req.body.check;
  check.tags = Check.convertTags(check.tags);
  check.interval = req.body.check.interval * 1000;
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
  res.render('tags', { route: app.route });
});

app.get('/tag/:name', function(req, res, next) {
  Tag.findOne({ name: req.params.name }, function(err, tag) {
    if (err) return next(err);
    if (!tag) return next(new Error('failed to load tag ' + req.params.name));
    res.render('tag', { route: app.route, tag: tag });
  });
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
