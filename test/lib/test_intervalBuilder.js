process.env.NODE_ENV = 'test';
var should = require('should');
var async = require('async');
var mongoose = require('../../bootstrap');
var IntervalBuilder = require('../../lib/intervalBuilder');
var Ping = require('../../models/ping');
var Check = require('../../models/check');
var CheckEvent = require('../../models/checkEvent');

var check1, check2, now; // fixtures

describe('intervalBuilder', function() {

  before(function(done) {
    async.parallel([
      function(cb) { Ping.collection.remove({ }, cb) },
      function(cb) { Check.collection.remove({ }, cb) },
      function(cb) { CheckEvent.collection.remove({ }, cb) },
    ], done);
  });

  before(function() {
    now = Date.now();
  });

  describe('#addTarget', function() {

    it('should accept Check objects', function() {
      var builder = new IntervalBuilder();
      builder.isEmpty().should.be.ok;
      var check = new Check();
      var id = check._id;
      builder.addTarget(check);
      builder.isEmpty().should.not.be.ok;
      builder.objectIds.should.eql([id]);
    });

    it('should accept Check identifiers', function() {
      var builder = new IntervalBuilder();
      builder.isEmpty().should.be.ok;
      builder.addTarget('1234');
      builder.isEmpty().should.not.be.ok;
      builder.objectIds.should.eql(['1234']);
    });

  });

  describe('#changeObjectState', function() {

    it('should change the builder state to UP when passed an up event', function() {
      var builder = new IntervalBuilder();
      builder.addTarget('1234');
      builder.changeObjectState('1234', 'up');
      builder.isUp('1234').should.be.ok;
      builder.isDown('1234').should.not.be.ok;
      builder.isPaused('1234').should.not.be.ok;
    });

    it('should change the builder state to DOWN when passed a down event', function() {
      var builder = new IntervalBuilder();
      builder.addTarget('1234');
      builder.changeObjectState('1234', 'down');
      builder.isUp('1234').should.not.be.ok;
      builder.isDown('1234').should.be.ok;
      builder.isPaused('1234').should.not.be.ok;
    });

    it('should change the builder state to PAUSED when passed a paused event', function() {
      var builder = new IntervalBuilder();
      builder.addTarget('1234');
      builder.changeObjectState('1234', 'paused');
      builder.isUp('1234').should.not.be.ok;
      builder.isDown('1234').should.not.be.ok;
      builder.isPaused('1234').should.be.ok;
    });

    it('should change the builder state to PAUSED when passed a restarted event', function() {
      var builder = new IntervalBuilder();
      builder.addTarget('1234');
      builder.changeObjectState('1234', 'restarted');
      builder.isUp('1234').should.not.be.ok;
      builder.isDown('1234').should.not.be.ok;
      builder.isPaused('1234').should.be.ok;
    });

    it('should return true if the object state is modified', function() {
      var builder = new IntervalBuilder();
      builder.addTarget('1234');
      builder.changeObjectState('1234', 'up').should.be.ok;
      builder.changeObjectState('1234', 'down').should.be.ok;
      builder.changeObjectState('1234', 'up').should.be.ok;
      builder.changeObjectState('1234', 'paused').should.be.ok;
      builder.changeObjectState('1234', 'down').should.be.ok;
      builder.changeObjectState('1234', 'paused').should.be.ok;
      builder.changeObjectState('1234', 'up').should.be.ok;
      builder.changeObjectState('1234', 'restarted').should.be.ok;
      builder.changeObjectState('1234', 'down').should.be.ok;
      builder.changeObjectState('1234', 'restarted').should.be.ok;
      builder.changeObjectState('1234', 'up').should.be.ok;
    });

    it('should return false if the object state is not modified', function() {
      var builder = new IntervalBuilder();
      builder.addTarget('1234');
      builder.changeObjectState('1234', 'up');
      builder.changeObjectState('1234', 'up').should.not.be.ok;
      builder.changeObjectState('1234', 'down');
      builder.changeObjectState('1234', 'down').should.not.be.ok;
      builder.changeObjectState('1234', 'paused');
      builder.changeObjectState('1234', 'paused').should.not.be.ok;
      builder.changeObjectState('1234', 'restarted').should.not.be.ok;
      builder.changeObjectState('1234', 'restarted').should.not.be.ok;
      builder.changeObjectState('1234', 'paused').should.not.be.ok;
    });

  });

  describe('#getGlobalState', function() {

    it('should equal the target state when the target is unique', function() {
      var builder = new IntervalBuilder();
      builder.addTarget(1234);
      builder.changeObjectState(1234, 'up');
      builder.getGlobalState().should.eql(builder.UP);
      builder.changeObjectState(1234, 'down');
      builder.getGlobalState().should.eql(builder.DOWN);
      builder.changeObjectState(1234, 'paused');
      builder.getGlobalState().should.eql(builder.PAUSED);
      builder.changeObjectState(1234, 'restarted');
      builder.getGlobalState().should.eql(builder.PAUSED);
    });

    it('should be DOWN when at least one target is down', function() {
      var builder = new IntervalBuilder();
      builder.addTarget(1);
      builder.addTarget(2);
      builder.addTarget(3);
      builder.addTarget(4);
      builder.changeObjectState(1, 'up');
      builder.changeObjectState(2, 'down');
      builder.changeObjectState(3, 'paused');
      builder.changeObjectState(4, 'restarted');
      builder.getGlobalState().should.eql(builder.DOWN);
    });

    it('should be PAUSED when all targets are paused', function() {
      var builder = new IntervalBuilder();
      builder.addTarget(1);
      builder.addTarget(2);
      builder.addTarget(3);
      builder.addTarget(4);
      builder.changeObjectState(1, 'restared');
      builder.changeObjectState(2, 'paused');
      builder.changeObjectState(3, 'paused');
      builder.changeObjectState(4, 'restarted');
      builder.getGlobalState().should.eql(builder.PAUSED);
    });

    it('should be UP when no target are down', function() {
      var builder = new IntervalBuilder();
      builder.addTarget(1);
      builder.addTarget(2);
      builder.addTarget(3);
      builder.addTarget(4);
      builder.changeObjectState(1, 'restared');
      builder.changeObjectState(2, 'paused');
      builder.changeObjectState(3, 'up');
      builder.changeObjectState(4, 'restarted');
      builder.getGlobalState().should.eql(builder.UP);
    });

  });

  describe('#determineInitialState', function() {

    before(function(done) {
      check1 = new Check();
      check1.save(function(err) {
        if (err) throw (err);
        async.series([
          function(cb) { Ping.createForCheck(false, now - 2000, 100, check1, 'dummy2', '', null, cb); },
          function(cb) { Ping.createForCheck(true,  now - 1000, 100, check1, 'dummy3', '', null, cb); }
        ], done);
      });
    });

    before(function(done) {
      check2 = new Check();
      check2.save(done);
    });

    it('should set initial state to PAUSED for new Checks', function(done) {
      var builder = new IntervalBuilder();
      builder.addTarget(check2);
      builder.determineInitialState(now, function(err) {
        if (err) throw (err);
        builder.currentState.should.eql(builder.PAUSED);
        done();
      });
    });

    it('should set the initial state to UP if the latest ping is up', function(done) {
      var builder = new IntervalBuilder(check1);
      builder.addTarget(check1);
      builder.determineInitialState(now, function(err) {
        if (err) throw (err);
        builder.currentState.should.eql(builder.UP);
        done();
      });
    });

    it('should set the initial state to DOWN if the latest ping is down', function(done) {
      var builder = new IntervalBuilder(check1);
      builder.addTarget(check1);
      builder.determineInitialState(now - 1500, function(err) {
        if (err) throw (err);
        builder.currentState.should.eql(builder.DOWN);
        done();
      });
    });

    after(function(done) {
      async.parallel([
        function(cb) { Ping.collection.remove({ }, cb) },
        function(cb) { Check.collection.remove({ }, cb) },
        function(cb) { CheckEvent.collection.remove({ }, cb) },
      ], done);
    });

  });

  describe('#build', function() {

    before(function(done) {
      check1 = new Check();
      check1.save(function(err) {
        if (err) return done(err);
        async.series([
          function(cb) { Ping.createForCheck(false, now - 3000, 100, check1, 'dummy1', '', null, cb); },
          function(cb) { Ping.createForCheck(false, now - 2000, 100, check1, 'dummy2', '', null, cb); },
          function(cb) { Ping.createForCheck(true,  now - 1000, 100, check1, 'dummy3', '', null, cb); },
          function(cb) { Ping.createForCheck(true,  now,        100, check1, 'dummy4', '', null, cb); },
          function(cb) { Ping.createForCheck(true,  now + 1000, 100, check1, 'dummy5', '', null, cb); },
          function(cb) { Ping.createForCheck(false, now + 2000, 100, check1, 'dummy6', '', null, cb); },
          function(cb) { Ping.createForCheck(true,  now + 3000, 100, check1, 'dummy7', '', null, cb); }
        ], done);
      });
    });

    before(function(done) {
      check2 = new Check();
      check2.save(done);
    });

    it('should return a full pause array when there is no ping at all', function(done) {
      var builder = new IntervalBuilder();
      builder.addTarget(check2);
      builder.build(now, now + 1000, function(err, periods) {
        if (err) return done(err);
        periods.should.eql([[now, now + 1000, builder.PAUSED]]);
        done();
      });
    });

    it('should return an empty array when there is no down ping', function(done) {
      var builder = new IntervalBuilder();
      builder.addTarget(check1);
      builder.build(now + 3000, now + 6000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([]);
        done();
      });
    });

    it('should return a period ending at the end of the lookup period when the latest ping is down', function(done) {
      var builder = new IntervalBuilder();
      builder.addTarget(check1);
      builder.build(now - 2500, now - 2000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([ [now - 2500, now - 2000, 0] ]);
        done();
      });
    });

    it('should return an outage period even if the state at the beginning and at the end are up', function(done) {
      var builder = new IntervalBuilder();
      builder.addTarget(check1);
      builder.build(now - 1000, now + 3000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([ [ now + 2000, now + 3000, 0]]);
        done();
      });
    });

    it('should return several periods when an uptime period lies in the middle of the interval', function(done) {
      var builder = new IntervalBuilder();
      builder.addTarget(check1);
      builder.build(now - 4000, now + 3000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([ [now - 4000, now - 3000, -1], [now - 3000, now - 1000, 0], [now + 2000, now + 3000, 0] ]);
        done();
      });
    });

    after(function(done) {
      async.parallel([
        function(cb) { Ping.collection.remove({ }, cb) },
        function(cb) { Check.collection.remove({ }, cb) },
        function(cb) { CheckEvent.collection.remove({ }, cb) },
      ], done);
    });
  });
  
});
