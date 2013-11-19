process.env.NODE_ENV = 'test';
var mongoose = require('../../bootstrap');
var Check = require('../../models/check');
var app = require('../../app');
var assert = require('assert');
var http = require('http');

describe('GET /checks', function() {

  var check1, check2, pollerCollection; // fixtures

  before(function(done) {
    pollerCollection = app.get('pollerCollection');
    this.server = app.listen(3000, done);
  });

  before(function(done) {
    Check.remove({}, done);
  });

  before(function(done) {
    check1 = new Check();
    check1.url = 'http://www.url1.fr';
    check1.name = 'name1';
    check1.isPaused = false;
    check1.save(done);
  });

  before(function(done) {
    check2 = new Check();
    check2.url = 'http://www.url2.fr';
    check2.isPaused = false;
    check2.save(done);
  });

  it('should fetch all elements', function(done) {

    var options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/checks',
      headers: {
        'Accept': 'application/json'
      }
    };

    var req = http.request(options, function(res) {
      var body = "";
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });

      res.on('end', function(){
        content = JSON.parse(body);
        assert.equal(content.length, 2);
        done();
      });
    });

    req.end();

    req.on('error', function(e) {
      done(new Error('Error on GET request'))
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
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
        Check.findOne({ _id : object._id }, function(error, document) {
          if (error) {return done(new Error('Error, object not found'))}
          assert.notEqual(typeof(document), 'undefined');
          assert.notEqual(typeof(error), null);
          assert.equal(document.name, 'test');
          done();
        });
      });
    });

    req.on('error', function(e) {
      done(new Error('Error on PUT request'))
    });

    req.write(postData);
    req.end();
  });

  it('should add a new element with url as name if name is empty', function(done) {
    var postData = JSON.stringify({
      name: '',
      url:'http://mynewurl.test'
    });

    var options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/checks',
      method: 'PUT',
      headers: {
        'Content-Length': postData.length,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
        assert.equal(object.url, object.name);
        done();
      });
    });

    req.on('error', function(e) {
      done(new Error('Error on PUT request'))
    });

    req.write(postData);
    req.end();
  });

  it('should not add an invalid element with no url', function(done) {
    var postData = JSON.stringify({
      name: 'test'
    });

    var options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/checks',
      method: 'PUT',
      headers: {
        'Content-Length': postData.length,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
        assert.notEqual(typeof(object.error), 'undefined');
        done();
      });
    });

    req.on('error', function(e) {
      done(new Error('Error on PUT request'))
    });

    req.write(postData);
    req.end();
  });

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

  before(function(done) {
    check1 = new Check();
    check1.url = 'http://www.url1.fr';
    check1.name = 'name1';
    check1.isPaused = false;
    check1.save(done);
  });

  before(function(done) {
    check2 = new Check();
    check2.url = 'http://www.url2.fr';
    check2.isPaused = false;
    check2.save(done);
  });

  it('should return error if id parameter does not exists', function(done) {

    var postData = JSON.stringify({
      name: 'test'
    });

    var options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/checks/toto',
      method: 'POST',
      headers: {
        'Content-Length': postData.length,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
        assert.notEqual(typeof(object.error), 'undefined');
        done();
      });
    });

    req.on('error', function(e) {
      done(new Error('Error on PUT request'))
    });

    req.write(postData);
    req.end();
  });

  it('should update object if parameters are valid', function(done) {

    var postData = JSON.stringify({
      name: 'test',
      url:'http://newurl.test'
    });

    var options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/checks/' + check1.id,
      method: 'POST',
      headers: {
        'Content-Length': postData.length,
        'Content-type': 'application/json',
        'Accept': 'application/json'
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
        assert.equal(object.name, 'test');
        assert.equal(object.url, 'http://newurl.test');
        done();
      });
    });

    req.on('error', function(e) {
      done(new Error('Error on PUT request'))
    });

    req.write(postData);
    req.end();
  });

  it('should not throw error if called twice on same id', function(done) {
    var postData = JSON.stringify({
      name: 'test',
      url:'http://newurl.test'
    });

    var options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/checks/' + check1.id,
      method: 'POST',
      headers: {
        'Content-Length': postData.length,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
        assert.equal(typeof(object.error), 'undefined');
        assert.notEqual(typeof(object.name), 'undefined');
        done();
      });
    });

    req.on('error', function(e) {
      done(new Error('Error on PUT request'))
    });

    req.write(postData);
    req.end();
  });

  after(function(done) {
    Check.remove({}, done);
  });

  after(function(done) {
    this.server.close(done);
  });
});
