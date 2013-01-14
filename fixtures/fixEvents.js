var config   = require('config').mongodb;
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var CheckEvent = new Schema({
  timestamp   : { type: Date, default: Date.now },
  check       : { type: Schema.ObjectId, ref: 'Check' },
  tags        : [String],
  message     : String,
  isGoDown    : Boolean,
  details     : String,
  // for error events, more details need to be persisted
  downtime    : Number
});

mongoose.model('CheckEvent', CheckEvent);

mongoose.connect('mongodb://' + config.user + ':' + config.password + '@' + config.server +'/' + config.database);
mongoose.connection.on('error', function (err) {
  console.error('MongoDB error: ' + err.message);
  console.error('Make sure a mongoDB server is running and accessible by this application')
});

var Event = mongoose.model('CheckEvent');
Event.find({ message: { $exists: false }}).each(function(err, event) {
  if (err) {
    console.log(err.message);
    return;
  }
  if (!event) process.exit();
  event.message = event.isGoDown ? 'down' : 'up';
  event.save();
});