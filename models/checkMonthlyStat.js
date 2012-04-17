var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var CheckMonthlyStat = new Schema({
  check       : { type: Schema.ObjectId, ref: 'Check' },
  timestamp   : Date,
  count       : Number,
  ups         : Number,
  responsives : Number,
  time        : Number,
  downtime    : Number
});
CheckMonthlyStat.index({ check: 1, timestamp: -1 }, { unique: true });
CheckMonthlyStat.plugin(require('../lib/lifecycleEventsPlugin'));

module.exports = mongoose.model('CheckMonthlyStat', CheckMonthlyStat);