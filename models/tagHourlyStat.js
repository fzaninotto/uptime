var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// main model
var TagHourlyStat = new Schema({
    name        : String
  , timestamp   : Date
  , count       : Number
  , ups         : Number
  , responsives : Number
  , time        : Number
  , downtime    : Number
});
TagHourlyStat.index({ name: 1, timestamp: -1 }, { unique: true });

module.exports = mongoose.model('TagHourlyStat', TagHourlyStat);