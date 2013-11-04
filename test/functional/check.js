process.env.NODE_ENV = 'test';
var mongoose = require('../../bootstrap');
var Check = require('../../models/check');
var app = require('../../app');
var assert = require('assert');
var http = require('http');
var request = require('request');

describe('GET /checks', function() {

  var check1, check2, pollerCollection; // fixtures

  before(function() {
    this.server = app.listen(3000);
    pollerCollection = app.get('pollerCollection');
  });

  before(function() {
    check1 = new Check();
    check1.url = 'http://www.url1.fr';
    check1.name = 'name1';
    check1.isPaused = false;
    check1.save();

    check2 = new Check();
    check2.url = 'http://www.url2.fr';
    check2.isPaused = false;
    check2.save();
  });

  it('should fetch all elements', function(done) {
    request('http://127.0.0.1:3000/api/checks', function(err, resp, body){
      assert(!err);
      content = JSON.parse(body);
      assert.equal(content.length, 2);
      done();
    });
  });

  after(function(done) {
    Check.remove({}, done);
  });

  after(function(done) {
    this.server.close(done);
  });

});
