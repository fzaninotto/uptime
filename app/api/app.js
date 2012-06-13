/**
 * Module dependencies.
 */
var express    = require('express');
var Check      = require('../../models/check');
var CheckEvent = require('../../models/checkEvent');

var app = module.exports = express.createServer();

// middleware

app.configure(function(){
  app.use(app.router);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// up count
var upCount;
var refreshUpCount = function(callback) {
  var count = { up: 0, down: 0, paused: 0, total: 0 };
  Check.find({}).only(['isUp', 'isPaused']).each(function(err, check) {
    if (check) {
      count.total++;
      if (check.isPaused) {
        count.paused++;
      } else if (check.isUp) {
        count.up++;
      } else {
        count.down++;
      }
    } else {
      upCount = count;
      callback();
    }
  });
}

Check.on('afterInsert', function() { upCount = undefined; });
Check.on('afterRemove', function() { upCount = undefined; });
CheckEvent.on('afterInsert', function() { upCount = undefined; });

app.get('/checks/count', function(req, res) {
  if (upCount) {
    res.json(upCount);
  } else {
    refreshUpCount(function() {
      res.json(upCount);
    });
  }
});

// Routes

require('./routes/check')(app);
require('./routes/tag')(app);
require('./routes/ping')(app);

// route list
app.get('/', function(req, res) {
  var routes = [];
  app.routes.all().forEach(function(route) {
    routes.push({method: route.method.toUpperCase() , path: app.route + route.path});
  });
  res.json(routes);
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}