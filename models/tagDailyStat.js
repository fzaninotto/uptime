var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var TagDailyStat = new Schema({
  name        : String,
  timestamp   : Date,
  count       : Number,
  ups         : Number,
  responsives : Number,
  time        : Number,
  downtime    : Number
});
TagDailyStat.index({ name: 1, timestamp: -1 }, { unique: true });
TagDailyStat.plugin(require('mongoose-lifecycle'));

module.exports = mongoose.model('TagDailyStat', TagDailyStat);