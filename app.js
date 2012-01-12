/*
 * Monitor remote server uptime.
 */

var mongoose = require('mongoose'),
    express  = require('express'),
    monitor  = require('./lib/monitor'),
    port     = (process.env.PORT || 8081);

// configure mongodb
var mongodbUser = 'root';
var mongodbPassword = '';
var mongodbServer = 'localhost';
var mongodbDatabase = 'uptime';
mongoose.connect('mongodb://' + mongodbUser + ':' + mongodbPassword + '@' + mongodbServer +'/' + mongodbDatabase);

// poll checks every 5 seconds and update the QoS score every 10 seconds
m = monitor.createMonitor(5000, 10000);
m.start();

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  var oneYear = 31557600000;
  app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
  app.use(express.errorHandler());
});

// Routes
app.use('/api',       require('./app/api/app'));
app.use('/dashboard', require('./app/dashboard/app'));

app.listen(port);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
