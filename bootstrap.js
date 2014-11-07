var mongoose   = require('mongoose');
var config     = require('config');
var semver     = require('semver');
var util       = require('util')

var connectionString = config.mongodb.connectionString
if (!connectionString) {
	if(config.mongodb.user && config.mongodb.password) {
		connectionString = util.format('mongodb://%s:%s@%s/%s', config.mongodb.user, config.mongodb.password, config.mongodb.server, config.mongodb.database)
	} else {
		connectionString = util.format('mongodb://%s/%s', config.mongodb.server, config.mongodb.database)
	}
}

if (process.env.UPTIME_MONGO_1_PORT_27017_TCP_ADDR) {
	/* If this environment variable is set we are running trough fig.
	   This is the worst hack I have ever done. I feel ashamed.
	*/
	connectionString = util.format('mongodb://%s/%s', process.env.UPTIME_MONGO_1_PORT_27017_TCP_ADDR, config.mongodb.database)
}

mongoose.connect(connectionString)
mongoose.connection.on('error', function (err) {
  console.error('MongoDB error: ' + err.message);
  console.error('Make sure a mongoDB server is running and accessible by this application');
  process.exit(1);
});

mongoose.connection.on('open', function (err) {
  mongoose.connection.db.admin().serverStatus(function(err, data) {
    if (err) {
      if (err.name === "MongoError" && (err.errmsg === 'need to login' || err.errmsg === 'unauthorized') && !config.mongodb.connectionString) {
        console.log('Forcing MongoDB authentication');
        mongoose.connection.db.authenticate(config.mongodb.user, config.mongodb.password, function(err) {
          if (!err) return;
          console.error(err);
          process.exit(1);
        });
        return;
      } else {
        console.error(err);
        process.exit(1);
      }
    }
    if (!semver.satisfies(data.version, '>=2.1.0')) {
      console.error('Error: Uptime requires MongoDB v2.1 minimum. The current MongoDB server uses only '+ data.version);
      process.exit(1);
    }
  });
});


module.exports = mongoose;
