var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var TagHourlyStat = new Schema({
  name        : String,
  timestamp   : Date,
  count       : Number,
  ups         : Number,
  responsives : Number,
  time        : Number,
  downtime    : Number
});
TagHourlyStat.index({ name: 1, timestamp: -1 }, { unique: true });
TagHourlyStat.plugin(require('mongoose-lifecycle'));

module.exports = mongoose.model('TagHourlyStat', TagHourlyStat);