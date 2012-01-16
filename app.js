/*
 * Monitor remote server uptime.
 */

var mongoose = require('mongoose'),
    express  = require('express'),
    config   = require('./config/config.js'),
    monitor  = require('./lib/monitor');

// configure mongodb
mongoose.connect('mongodb://' + config.mongodbUser + ':' + config.mongodbPassword + '@' + config.mongodbServer +'/' + config.mongodbDatabase);

// see if a check needs a new poll every 10 seconds
// and update the QoS score every minute
m = monitor.createMonitor();
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

app.listen(config.web_port);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
