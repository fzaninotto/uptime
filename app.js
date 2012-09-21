/*
 * Monitor remote server uptime.
 */

var http       = require('http');
var express    = require('express');
var config     = require('config');
var socketIo   = require('socket.io');
var fs         = require('fs');
var monitor    = require('./lib/monitor');
var analyzer   = require('./lib/analyzer');
var CheckEvent = require('./models/checkEvent');
var Ping       = require('./models/ping');

// database

var mongoose   = require('./bootstrap');

// monitor

if (config.autoStartMonitor) {
  m = monitor.createMonitor(config.monitor);
  m.start();
}

a = analyzer.createAnalyzer(config.analyzer);
a.start();

// web front

var app = module.exports = express();
var server = http.createServer(app);

app.configure(function(){
  app.use(app.router);
  // the following middlewares are only necessary for the mounted 'dashboard' app, 
  // but express needs it on the parent app (?) and it therefore pollutes the api
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'qdfegsgkjhflkquhfskqdjfhskjdfh' }));
});

app.configure('development', function() {
  if (config.verbose) mongoose.set('debug', true);
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
  var oneYear = 31557600000;
  app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
  app.use(express.errorHandler());
});

// Routes
app.use('/api',       require('./app/api/app'));
app.use('/dashboard', require('./app/dashboard/app'));
app.get('/', function(req, res) {
  res.redirect('/dashboard/events');
});
app.get('/favicon.ico', function(req, res) {
  res.redirect(301, '/dashboard/favicon.ico');
});

// Sockets
var io = socketIo.listen(server);

io.configure('production', function() {
  io.enable('browser client etag');
  io.set('log level', 1);
});

io.configure('development', function() {
  if (!config.verbose) io.set('log level', 1);
});

CheckEvent.on('afterInsert', function(event) {
  io.sockets.emit('CheckEvent', event.toJSON());
});

io.sockets.on('connection', function(socket) {
  socket.on('set check', function(check) {
    socket.set('check', check);
  });
  Ping.on('afterInsert', function(ping) {
    socket.get('check', function(err, check) {
      if (ping.check == check) {
        socket.emit('ping', ping);
      }
    });
  });
});

// load plugins
fs.exists('./plugins/index.js', function(exists) {
  if (exists) {
    require('./plugins').init(app, io, config, mongoose);
  };
});

server.listen(config.server.port);
console.log("Express server listening on port %d in %s mode", config.server.port, app.settings.env);
