var should = require('should');
var async = require('async');
var mongoose = require('../../bootstrap');
var UptimeCalculator = require('../../lib/uptimeCalculator');
var Check = require('../../models/check');
var CheckEvent = require('../../models/checkEvent');
var Ping = require('../../models/ping');

var check1, check2, now; // fixtures

describe('uptimeCalculator', function() {

  before(function(done) {
    async.parallel([
      function(cb) { Ping.collection.drop(cb) },
      function(cb) { Check.collection.drop(cb) },
      function(cb) { CheckEvent.collection.drop(cb) },
    ], done);
  });

  before(function() {
    now = Date.now();
  });

  before(function(done) {
    check1 = new Check();
    check1.save(function(err) {
      if (err) throw (err);
      async.series([
        function(cb) { Ping.createForCheck(false, now - 3000, 100, check1, 'dummy1', '', cb); },
        function(cb) { Ping.createForCheck(false, now - 2000, 100, check1, 'dummy2', '', cb); },
        function(cb) { Ping.createForCheck(true,  now - 1000, 100, check1, 'dummy3', '', cb); },
        function(cb) { Ping.createForCheck(true,  now,        100, check1, 'dummy4', '', cb); },
        function(cb) { Ping.createForCheck(true,  now + 1000, 100, check1, 'dummy5', '', cb); },
        function(cb) { Ping.createForCheck(false, now + 2000, 100, check1, 'dummy6', '', cb); },
        function(cb) { Ping.createForCheck(true,  now + 3000, 100, check1, 'dummy7', '', cb); },
      ], done);
    });
  });

  before(function(done) {
    check2 = new Check();
    check2.save(done);
  });

  describe('#constructor', function() {

    it('should accept Check objects', function(done) {
      var calculator = new UptimeCalculator(check1);
      calculator.getPingBeforeTime(now - 3000, function(err, ping) {
        if (err) throw (err);
        ping.monitorName.should.eql('dummy1');
        done();
      });
    });

    it('should accept Check identifiers', function(done) {
      var calculator = new UptimeCalculator(check1._id);
      calculator.getPingBeforeTime(now - 3000, function(err, ping) {
        if (err) throw (err);
        ping.monitorName.should.eql('dummy1');
        done();
      });
    });

  });

  describe('#getPingBeforeTime', function() {

    it('should return nothing for new Checks', function(done) {
      var calculator = new UptimeCalculator(check2);
      calculator.getPingBeforeTime(now, function(err, ping) {
        if (err) throw (err);
        should.not.exist(ping);
        done();
      });
    });

    it('should return the latest ping', function(done) {
      var calculator = new UptimeCalculator(check1);
      calculator.getPingBeforeTime(now, function(err, ping) {
        if (err) throw (err);
        ping.monitorName.should.eql('dummy4');
        done();
      });
    });

  });

  describe('#getUptimePeriods', function() {

    it('should return an empty array when there is no ping at all', function(done) {
      var calculator = new UptimeCalculator(check2);
      calculator.getUptimePeriods(Date.now(), Date.now() + 1000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([]);
        done();
      });
    });

    it('should return an empty array when there is no up ping', function(done) {
      var calculator = new UptimeCalculator(check1);
      calculator.getUptimePeriods(now - 6000, now - 3000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([ ]);
        done();
      });
    });

    it('should return a period ending at the end of the lookup period when the latest ping is up', function(done) {
      var calculator = new UptimeCalculator(check1);
      calculator.getUptimePeriods(now + 3000, now + 6000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([ [now + 3000, now + 6000] ]);
        done();
      });
    });

    it('should return a period starting at the beginning of the lookup period when the previous ping is up', function(done) {
      var calculator = new UptimeCalculator(check1);
      calculator.getUptimePeriods(now, now + 1000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([ [now, now + 1000] ]);
        done();
      });
    });

    it('should return an uptime period even if the state at the beginning and at the end are down', function(done) {
      var calculator = new UptimeCalculator(check1);
      calculator.getUptimePeriods(now - 3000, now + 2000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([ [ now - 1000, now + 2000 ]]);
        done();
      });
    });

    it('should return the several periods when a downtime period lies in the middle of the interval', function(done) {
      var calculator = new UptimeCalculator(check1);
      calculator.getUptimePeriods(now - 3000, now + 3000, function(err, periods) {
        if (err) throw (err);
        periods.should.eql([ [now - 1000, now + 2000], [now + 3000, now + 3000] ]);
        done();
      });
    });

  });
  
  describe('#testMergeConsecutivePeriods', function() {
    it('should return empty array when passed an empty array', function() {
      UptimeCalculator.mergeConsecutivePeriods([]).should.eql([]);
    });
    it('should return a single periods array when passed a single periods array', function() {
      UptimeCalculator.mergeConsecutivePeriods([[[1, 2]]]).should.eql([[1, 2]]);
    });
    it('should return a two periods array when passed a two non adjacent periods array', function() {
      UptimeCalculator.mergeConsecutivePeriods([[[1, 2]], [[3, 4]]]).should.eql([[1, 2], [3, 4]]);
    });
    it('should concatenate adjacent periods array', function() {
      UptimeCalculator.mergeConsecutivePeriods([[[1, 2]], [[2, 3]]]).should.eql([[1, 3]]);
    });
    it('should flatten period arrays', function() {
      UptimeCalculator
      .mergeConsecutivePeriods([ [[1, 2], [4, 5], [8, 9]], [[9, 11], [13, 14]], [[16, 18], [20, 21]], [[21, 22]] ])
      .should.eql([ [1, 2], [4, 5], [8, 11], [13, 14], [16, 18], [20, 22] ]);
    });
  });

  describe('#testNegatePeriods', function() {
    it('should return an empty period when passed a full uptime array', function() {
      UptimeCalculator.negatePeriods(1, 10, [[1, 10]]).should.eql([]);
    });
    it('should return a full period when passed an empty uptime array', function() {
      UptimeCalculator.negatePeriods(1, 10, []).should.eql([[1, 10]]);
    });
    it('should return two periods when passed an uptime array in the middle', function() {
      UptimeCalculator.negatePeriods(1, 10, [[4, 5]]).should.eql([[1, 4], [5, 10]]);
    });
    it('should negate period arrays', function() {
      UptimeCalculator
      .negatePeriods(1, 10, [[1, 2], [4, 5], [8, 9]])
      .should.eql([ [2, 4], [5, 8], [9, 10] ]);
    });
  });

  describe('#testMergePeriods', function() {
    it('should return a full period when passed a full uptime array', function() {
      UptimeCalculator.mergePeriods([[[1, 10]]]).should.eql([[1, 10]]);
    });
    it('should return an empty period when passed no uptime periods', function() {
      UptimeCalculator.mergePeriods([]).should.eql([]);
    });
    it('should return the flattened list of periods when there is only one', function() {
      UptimeCalculator.mergePeriods([[[1, 3], [5, 7], [8, 9]]]).should.eql([[1, 3], [5, 7], [8, 9]]);
    });
    it('should return two period for not overlapping periods', function() {
      UptimeCalculator.mergePeriods([ [[1, 2]], [[4, 5]] ]).should.eql([[1, 2], [4, 5]]);
    });
    it('should return a single period for overlapping periods', function() {
      UptimeCalculator.mergePeriods([ [[1, 5]], [[4, 6]] ]).should.eql([[1, 6]]);
    });
    it('should return the periods when listed several times', function() {
      UptimeCalculator
      .mergePeriods([ [[1, 2], [4, 5], [6, 7], [8, 9]], [[1, 2], [4, 5], [6, 7], [8, 9]] ])
      .should.eql([[1, 2], [4, 5], [6, 7], [8, 9]]);
    });
    it('should return a periods list merging periods', function() {
      UptimeCalculator
      .mergePeriods([ [[1, 2], [4, 5], [8, 9]], [[1, 3], [4, 6], [8, 9]], [[4, 10]] ])
      .should.eql([ [1, 3], [4, 10] ]);
    });
  });

  describe('#testIntersectPeriods', function() {
    it('should return a full period when passed a full uptime array', function() {
      UptimeCalculator.intersectPeriods(1, 10, [[[1, 10]]]).should.eql([[1, 10]]);
    });
    it('should return an empty period when passed no uptime periods', function() {
      UptimeCalculator.intersectPeriods(1, 10, []).should.eql([]);
    });
    it('should return the flattened list of periods when there is only one', function() {
      UptimeCalculator.intersectPeriods(1, 10, [[[1, 3], [5, 7], [8, 9]]]).should.eql([[1, 3], [5, 7], [8, 9]]);
    });
    it('should return an empty period for not overlapping periods', function() {
      UptimeCalculator
      .intersectPeriods(1, 10, [ [[1, 2]], [[4, 5]] ])
      .should.eql([]);
    });
    it('should return a period for overlapping periods', function() {
      UptimeCalculator
      .intersectPeriods(1, 10, [ [[1, 5]], [[4, 6]] ])
      .should.eql([[4, 5]]);
    });
    it('should return the period when overlapping with the full range', function() {
      UptimeCalculator
      .intersectPeriods(1, 10, [ [[1, 10]], [[4, 6]] ])
      .should.eql([[4, 6]]);
    });
    it('should return the periods when listed several times', function() {
      UptimeCalculator
      .intersectPeriods(1, 10, [ [[1, 2], [4, 5], [6, 7], [8, 9]], [[1, 2], [4, 5], [6, 7], [8, 9]] ])
      .should.eql([[1, 2], [4, 5], [6, 7], [8, 9]]);
    });
    it('should return a periods list intersecting periods', function() {
      UptimeCalculator
      .intersectPeriods(1, 10, [ [[1, 2], [4, 5], [8, 9]], [[1, 9]], [[1, 3], [4, 6], [8, 9]], [[1, 9]] ])
      .should.eql([ [1, 2], [4, 5], [8, 9] ]);
    });
  });
  
});