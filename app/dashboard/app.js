/**
 * Module dependencies.
 */
var express = require('express');

var Check = require('../../models/check').Check;

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

app.get('/checks', function(req, res) {
  res.render('checks', { route: app.route });
});

app.get('/check/:id', function(req, res, next) {
  Check.findOne({ _id: req.params.id }, function(err, check) {
    if (err) return next(err);
    if (!check) return next(new Error('failed to load check ' + req.params.id));
    res.render('check', { route: app.route, check: check });
  });
});

app.get('/tags', function(req, res) {
  res.render('tags', { route: app.route });
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}