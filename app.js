/*
 * Monitor remote server uptime.
 */

var mongoose   = require('mongoose');
var express    = require('express');
var config     = require('config');
var socketIo   = require('socket.io');
var path       = require('path');
var monitor    = require('./lib/monitor');
var analyzer   = require('./lib/analyzer');
var CheckEvent = require('./models/checkEvent');
var Ping       = require('./models/ping');
var User       =  require('./models/user');
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;

// configure mongodb
mongoose.connect('mongodb://' + config.mongodb.user + ':' + config.mongodb.password + '@' + config.mongodb.server +'/' + config.mongodb.database);
mongoose.connection.on('error', function (err) {
  console.error('MongoDB error: ' + err.message);
  console.error('Make sure a mongoDB server is running and accessible by this application')
});

// auth

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ email: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Unknown user' });
      }
      return done(null, user);
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findOne({_id : id}, function (err, user) {
    done(err, user);
  });
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
  // the following middlewares are only necessary for the mounted 'dashboard' app, 
  // but express needs it on the parent app (?) and it therefore pollutes the api
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'qdfegsgkjhflkquhfskqdjfhskjdfh' }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
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

app.all('*', function(req, res, next){
  if (/(login|css|js|api|favicon.ico)/g.test(req.url)) {
    return next();
  } else if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/login?_next='+req.url);
  }
});

// Routes
app.use('/api',       require('./app/api/app'));
app.use('/dashboard', require('./app/dashboard/app'));

app.get('/', function(req, res) {
  res.redirect('/dashboard/events');
});

app.get('/login', function(req, res, next){
  console.log("next: " + req.query._next);
  res.render('login.ejs', {_next: req.query._next});
});

app.post('/login', passport.authenticate('local'), function(req, res) {
  if (req.query._next) res.redirect(req.query._next);
  else res.redirect('/');
});

app.get('/logout', function(req, res){
  req.logOut();
  res.redirect('/');
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
path.exists('./plugins/index.js', function(exists) {
  if (exists) {
    require('./plugins').init(app, io, config, mongoose);
  };
});


app.listen(config.server.port);
console.log("Express server listening on port %d in %s mode", config.server.port, app.settings.env);
