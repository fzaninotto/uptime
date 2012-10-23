var should = require('should');
var async = require('async');
var UptimeCalculator = require('../../lib/uptimeCalculator');

describe('uptimeCalculator', function() {
  
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
    it('should return a full period when passed a full outage array', function() {
      UptimeCalculator.mergePeriods([[[1, 10]]]).should.eql([[1, 10]]);
    });
    it('should return an empty period when passed no outage periods', function() {
      UptimeCalculator.mergePeriods([]).should.eql([]);
    });
    it('should return an empty period when passed empty outage periods', function() {
      UptimeCalculator.mergePeriods([[[]], [[]]]).should.eql([]);
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