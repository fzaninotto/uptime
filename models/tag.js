var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// main model
var Tag = new Schema({
    name        : String
  , lastUpdated : Date
  , count       : Number
  , ups         : Number
  , responsives : Number
  , time        : Number
  , downtime    : Number
});
Tag.index({ name: 1 }, { unique: true });

Tag.methods.getChecks = function(callback) {
  var Check   = require('./check')
  Check.find({ tags: this.name }, callback);
}

module.exports = mongoose.model('Tag', Tag);
