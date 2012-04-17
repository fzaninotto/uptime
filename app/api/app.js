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
  Check.count({}, function(err, total) {
    Check.count({ isUp: true}, function(err, nbUp) {
      upCount = { up: nbUp, down: total - nbUp, total: total };
      callback();
    });
  });
}

Check.on('postInsert', function() { upCount = undefined; });
Check.on('postRemove', function() { upCount = undefined; });
CheckEvent.on('postInsert', function() { upCount = undefined; });

app.get('/check/count', function(req, res) {
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

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}