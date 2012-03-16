var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// main model
var CheckDailyStat = new Schema({
    check       : { type: Schema.ObjectId, ref: 'Check' }
  , timestamp   : Date
  , count       : Number
  , ups         : Number
  , responsives : Number
  , time        : Number
  , downtime    : Number
});
CheckDailyStat.index({ check: 1, timestamp: -1 }, { unique: true });
CheckDailyStat.plugin(require('../lib/lifecycleEventsPlugin'));

module.exports = mongoose.model('CheckDailyStat', CheckDailyStat);