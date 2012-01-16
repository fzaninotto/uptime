var mongoose = require('mongoose'),
    config   = require('../config/config.js');

// configure mongodb
mongoose.connect('mongodb://' + config.mongodbUser + ':' + config.mongodbPassword + '@' + config.mongodbServer +'/' + config.mongodbDatabase);

// models dependencies
var Check   = require('../models/check');

// remove existing checks
Check.collection.drop(function(err) {
  addFixtures();
  console.log('Fixtures were added correctly');
  setTimeout(function() { 
    mongoose.connection.close();
  }, 1000)
});

function addFixtures() {

  new Check({
    url: 'http://localhost:8888/99.95',
    name: 'Top Quality',
    interval: 2000,
    maxTime: 15,
    tags: ['good', 'all']
  }).save();
  new Check({
    url: 'http://localhost:8888/99.85',
    name: 'Good Quality',
    interval: 2000,
    maxTime: 15,
    tags: ['good', 'all']
  }).save();
  new Check({
    url: 'http://localhost:8888/99',
    name: 'Neun und neunzig Luftballons',
    interval: 2000,
    maxTime: 15,
    tags: ['average', 'all']
  }).save();
  new Check({
    url: 'http://localhost:8888/80',
    name: 'My Crappy site',
    interval: 2000,
    maxTime: 15,
    tags: ['average', 'all']
  }).save();
  new Check({
    url: 'http://localhost:8888/75',
    name: 'The Crappy site I built for Al',
    interval: 2000,
    maxTime: 15,
    tags: ['low', 'all']
  }).save();

}

