var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

// main model
var CheckHourlyStat = new Schema({
  check          : { type: Schema.ObjectId, ref: 'Check' },
  timestamp      : Date,
  count          : Number,
  availability   : Number,
  responsiveness : Number,
  responseTime   : Number,
  downtime       : Number,
  outages        : Array
});
CheckHourlyStat.index({ check: 1, timestamp: -1 }, { unique: true });
CheckHourlyStat.plugin(require('mongoose-lifecycle'));

module.exports = mongoose.model('CheckHourlyStat', CheckHourlyStat);