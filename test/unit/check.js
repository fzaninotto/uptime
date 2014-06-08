var Check = require('../../models/check');
var PollerCollection = require('../../lib/pollers/pollerCollection');
var assert = require('assert');


describe('populateFromDirtyCheck', function() {

  var checkWithName, checkWithoutName, pollerCollection; // fixtures

  before(function() {
    pollerCollection = new PollerCollection();
  });

  beforeEach(function() {
    checkWithName = new Check();
    checkWithName.url = 'http://www.url1.fr';
    checkWithName.name = 'name1';
    checkWithName.isPaused = false;

    checkWithoutName = new Check();
    checkWithoutName.url = 'http://www.url2.fr';
    checkWithoutName.isPaused = false;
  });

  it('should update object', function() {
    checkWithName.populateFromDirtyCheck({url:'http://www.new-url.fr', name:'new-name'}, pollerCollection);
    assert.equal(checkWithName.name, 'new-name');
    assert.equal(checkWithName.url, 'http://www.new-url.fr');
  });

  it('should not erase empty values', function() {
    checkWithName.populateFromDirtyCheck({url:'http://www.new-url.fr'}, pollerCollection);
    assert.equal(checkWithName.name, 'name1');
    assert.equal(checkWithName.url, 'http://www.new-url.fr');
  });

  it('should use given url as name if check has no name and no name is given', function() {
    checkWithoutName.populateFromDirtyCheck({url:'http://www.new-url.fr'}, pollerCollection);
    assert.equal(checkWithoutName.name, 'http://www.new-url.fr');
    assert.equal(checkWithoutName.url, 'http://www.new-url.fr');
  });

  it('should use given url as name if check has no name and given name is empty', function() {
    checkWithoutName.populateFromDirtyCheck({url:'http://www.new-url.fr', name:''}, pollerCollection);
    assert.equal(checkWithoutName.name, 'http://www.new-url.fr');
    assert.equal(checkWithoutName.url, 'http://www.new-url.fr');
  });

  it('should not use given url if check has name and no name is given', function() {
    checkWithName.populateFromDirtyCheck({url:'http://www.new-url.fr'}, pollerCollection);
    assert.equal(checkWithName.name, 'name1');
    assert.equal(checkWithName.url, 'http://www.new-url.fr');
  });

  it('should use given name if check has no name name is given', function() {
    checkWithoutName.populateFromDirtyCheck({name:'new-name'}, pollerCollection);
    assert.equal(checkWithoutName.name, 'new-name');
    assert.equal(checkWithoutName.url, 'http://www.url2.fr');
  });

});
