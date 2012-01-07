/**
 * Module dependencies.
 */
var express = require('express');

var app = module.exports = express.createServer();

// middleware

app.configure(function(){
  app.use(app.router);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// Routes

require('./routes/check')(app);

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}