/*
 * Monitor remote server uptime.
 */

var mongoose   = require('mongoose'),
    express    = require('express'),
    config     = require('config'),
    socketIo   = require('socket.io'),
    path       = require('path'),
    monitor    = require('./lib/monitor'),
    analyzer   = require('./lib/analyzer'),
    CheckEvent = require('./models/checkEvent');

// configure mongodb
mongoose.connect('mongodb://' + config.mongodb.user + ':' + config.mongodb.password + '@' + config.mongodb.server +'/' + config.mongodb.database);
mongoose.connection.on('error', function (err) {
  console.error('MongoDB error: ' + err.message);
  console.error('Make sure a mongoDB server is running and accessible by this application')
});

if (config.autoStartMonitor) {
  m = monitor.createMonitor(config.monitor);
  m.start();
}

a = analyzer.createAnalyzer(config.analyzer);
a.start();

var app = module.exports = express.createServer();

// Site

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
app.get('/', function(reaq, res) {
  res.redirect('/dashboard/events');
});

// Sockets
var io = socketIo.listen(app);

io.configure('production', function() {
  io.enable('browser client etag');
  io.set('log level', 1);
});

io.configure('development', function() {
  if (!config.verbose) io.set('log level', 1);
});

CheckEvent.on('postInsert', function(event) {
  io.sockets.emit('CheckEvent', event.toJSON());
});

// load plugins
path.exists('./plugins/index.js', function(exists) {
  if (exists) {
    require('./plugins').init(app, io, config, mongoose);
  };
});

app.listen(config.server.port);
console.log("Express server listening on port %d in %s mode", config.server.port, app.settings.env);
