/*
 * API routes
 */

var Check = require('../models/check').Check;

exports.checkAll = function(req, res) {
  Check.byUptime().find({}).exclude('qos').run(function(err, checks) {
    res.json(checks);
  });
}

exports.checkOne = function(req, res){
  Check.findOne({ name: req.params.name }, function(err, check) {
    res.json(check);
  });
}