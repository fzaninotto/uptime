var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// main model
var CheckHourlyStat = new Schema({
    check       : Schema.ObjectId
  , timestamp   : Date
  , count       : Number
  , ups         : Number
  , responsives : Number
  , time        : Number
  , downtime    : Number
});
CheckHourlyStat.index({ check: 1, timestamp: -1 }, { unique: true });

module.exports = mongoose.model('CheckHourlyStat', CheckHourlyStat);