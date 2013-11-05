process.env.NODE_ENV = 'test';
var mongoose = require('../../bootstrap');
var Check = require('../../models/check');
var app = require('../../app');
var assert = require('assert');
var http = require('http');
var request = require('request');

describe('GET /checks', function() {

  var check1, check2, pollerCollection; // fixtures

  before(function(done) {
    pollerCollection = app.get('pollerCollection');
    this.server = app.listen(3000, done);
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


describe('PUT /checks', function() {

  before(function(done) {
    this.server = app.listen(3000, done);
  });

  it('should add a new valid element', function(done) {

    var postData = JSON.stringify({
      name: 'test',
      url:'http://test.local'
    });

    var options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/checks',
      method: 'PUT',
      headers: {
        'Content-Length': postData.length,
        'Content-Type': 'application/json'
      }
    };

    var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      var body = '';

      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        var object = JSON.parse(body);
        assert.notEqual(typeof(object._id), 'undefined');
        assert.notEqual(typeof(object.url), 'undefined');
        done();

        //@todo complete test : fecth object in database
      });
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    req.write(postData);
    req.end();
  });

  it('should not add an invalid element');

  after(function(done) {
    Check.remove({}, done);
  });

  after(function(done) {
    this.server.close(done);
  });
});


describe('POST /checks/:id', function() {

  var check1, check2, pollerCollection; // fixtures

  before(function(done) {
    pollerCollection = app.get('pollerCollection');
    this.server = app.listen(3000, done);
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

  it('should return error if id parameter does not exists');
  it('should update object if parameters are valid');
  it('should be the same object if called twice');


  after(function(done) {
    Check.remove({}, done);
  });

  after(function(done) {
    this.server.close(done);
  });
});

