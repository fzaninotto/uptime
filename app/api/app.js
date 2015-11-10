/**
 * Module dependencies.
 */
var express    = require('express');
var Check      = require('../../models/check');
var CheckEvent = require('../../models/checkEvent');
var errorhandler = require('errorhandler');

var app = module.exports = express();

var debugErrorHandler = function() {
  app.use(errorhandler({ dumpExceptions: true, showStack: true }));
}
//TODO fix this shitcode
var env = process.env.NODE_ENV || 'development';
if ('development' == env) {
   debugErrorHandler();
}
//TODO fix this shitcode
var env = process.env.NODE_ENV || 'test';
if ('test' == env) {
   debugErrorHandler();
}
//TODO fix this shitcode
var env = process.env.NODE_ENV || 'production';
if ('production' == env) {
   app.use(errorhandler());
}

// up count
var upCount;
var refreshUpCount = function(callback) {
  var count = { up: 0, down: 0, paused: 0, total: 0 };
  Check
  .find()
  .select({ isUp: 1, isPaused: 1 })
  .exec(function(err, checks) {
    if (err) return callback(err);
    checks.forEach(function(check) {
      count.total++;
      if (check.isPaused) {
        count.paused++;
      } else if (check.isUp) {
        count.up++;
      } else {
        count.down++;
      }
    });
    upCount = count;
    callback();
  });
};

Check.on('afterInsert', function() { upCount = undefined; });
Check.on('afterRemove', function() { upCount = undefined; });
CheckEvent.on('afterInsert', function() { upCount = undefined; });

app.get('/checks/count', function(req, res, next) {
  if (upCount) {
    res.json(upCount);
  } else {
    refreshUpCount(function(err) {
      if (err) return next(err);
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
  /*var routes = [];
  for (var verb in app.routes) {
    app.routes[verb].forEach(function(route) {
      routes.push({method: verb.toUpperCase() , path: app.route + route.path});
    });
  }
  res.json(routes);*/
  var routes = [];
  app._router.stack.forEach(function(r){
      if (r.route && r.route.path){
          console.log(r.route);
          routes.push({method: r.route.path.toUpperCase(), path: r.route.path});
          //routes.push({method: r.route.toUpperCase() , path: r.route + r.route.path});
      }
  })

  res.json(routes);
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
