var mongoose   = require('mongoose');
var config     = require('config');
var argv = require('optimist').argv;

var User       =  require('./models/user');

mongoose.connect('mongodb://' + config.mongodb.user + ':' + config.mongodb.password + '@' + config.mongodb.server +'/' + config.mongodb.database);
mongoose.connection.on('error', function (err) {
  console.error('MongoDB error: ' + err.message);
  console.error('Make sure a mongoDB server is running and accessible by this application')
});

var t_user = mongoose.model('User', User);

u = new t_user()

u.name = argv.name;
u.email = argv.email;
u.organization = argv.organization;
u.password = argv.password;

u.save(function(err){
	console.log(err)
	mongoose.connection.close();
});

mongoose.connection.close();