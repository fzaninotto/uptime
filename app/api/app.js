/**
 * Module dependencies.
 */
var express    = require('express'),
    Check      = require('../../models/check')
    CheckEvent = require('../../models/checkEvent');

var app = module.exports = express.createServer();

// middleware

app.configure(function(){
  app.use(app.router);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// up count
var upCount;
var refreshUpCount = function() {
  Check.count({}, function(err, total) {
    Check.count({ isUp: true}, function(err, nbUp) {
      upCount = { up: nbUp, down: total - nbUp, total: total };
    });
  });
}

refreshUpCount();
CheckEvent.on('insert', refreshUpCount);

app.get('/check/count', function(req, res) {
  res.json(upCount);
});

// Routes

require('./routes/check')(app);
require('./routes/tag')(app);
require('./routes/ping')(app);

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}