var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// main model
var Tag = new Schema({
    name        : String
  , qos         : {}
  , qosPerHour  : {}
});

Tag.statics.findOneOrCreate = function(query, callback) {
  var self = this;
  this.findOne(query, function(err, tag) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, tag || new self(query));
    }
  });
}

module.exports = mongoose.model('Tag', Tag);
