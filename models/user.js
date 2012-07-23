// user
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');

salt = "JohnCandyWrongWay"; // change it

hashpwd = function(plain_pw) {
	shasum = crypto.createHmac('sha1', salt);
	shasum.update(plain_pw);
	return shasum.digest('hex')
};

// user model
var User = new Schema({
  name		  : {type: String, required: true, unique: true, trim: true },
  organization: {type: String },
  email		  : {type: String, required: true, unique: true, trim: true, lowercase: true },
  password	  : {type: String, set: hashpwd, required: true },
  created_at  : {type: Date, default: Date.now},
  admin	 	  : {type: Boolean}
});

User.statics.authenticate = function(email, pw, fun) {
	if( email && pw ){
        mongoose.models.User.where('email', login).where('password', encodePassword(pw)).findOne(fun)
    }
}

isEmail = function(v){
    return (/^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i).test(v)
}

isEmpty = function(v){
	if (v.length > 0) return true;
	else return false;
};

User.path('email').validate(isEmail, 'format')
User.path('password').validate(isEmpty, 'password')


module.exports = mongoose.model('User', User);