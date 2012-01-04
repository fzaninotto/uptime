var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Target = new Schema({
    url         : String
  , timeout     : Number
  , weight      : Number
  , lastChanged : Date
  , lastTested  : Date
  , lastStatus  : Boolean
});
Target.methods.setLastTest = function(date, status) {
  this.lastTested = date;
  if (this.lastStatus != status) {
    this.lastChanged = date;
    this.lastStatus = status;
  }
  return this;
}
Target.methods.isUp = function() {
  return this.lastStatus == true;
}
Target.methods.getUptime = function() {
  if (!this.isUp()) return false;
  return Date.now() - this.lastChanged;
}

exports.Target = mongoose.model('Target', Target);
