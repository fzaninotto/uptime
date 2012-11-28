var async    = require('async');
var mongoose = require('../../bootstrap');
var QosAggregator = require('../../lib/qosAggregator');
var moment = require('../../app/dashboard/public/javascripts/moment.min.js');

var migrateQos = function(callback) {
  QosAggregator.updateLast24HoursQos(callback);
}

var migrateCheckStats = function(name, db, callback) {
  var nbMigratedDocuments = 0;
  var collection = db.collection(name);
  var statStream = collection.find().streamRecords();
  var unset = {
    ups: 1,
    responsives: 1,
    time: 1
  };
  statStream.on('data', function(stat) {
    if (stat.availability) {
      // already merged
      return;
    }
    var newStat = {
      availability: stat.ups / stat.count,
      responsiveness: stat.responsives / stat.count,
      responseTime: stat.time / stat.count,
      outages: [] // no way to get that back since CheckEvents are purged
    };
    collection.update({ _id: stat._id }, { $set: newStat, $unset: unset });
    nbMigratedDocuments++;
    if (nbMigratedDocuments % 100 == 0) {
      console.log('  Migrating ' + name + ' #' + nbMigratedDocuments);
    }
  });
  statStream.on('error', function(err) {
    callback(err);
  });
  statStream.on('end', function() {
    if (nbMigratedDocuments > 0) {
      console.log('  Finished: ' + nbMigratedDocuments + ' ' + name + ' migrated');
    } else {
      console.log('  No ' + name + ' to migrate');
    }
    callback();
  });
}

var addEndToMonthlyStat = function(name, db, callback) {
  var nbMigratedDocuments = 0;
  var collection = db.collection(name);
  var statStream = collection.find().streamRecords();
  statStream.on('data', function(stat) {
    if (stat.end) {
      // already merged
      return;
    }
    var end = moment(stat.timestamp).endOf('month').toDate();
    collection.update({ _id: stat._id }, { $set: { end: end } });
    nbMigratedDocuments++;
    if (nbMigratedDocuments % 100 == 0) {
      console.log('  Adding end date to ' + name + ' #' + nbMigratedDocuments);
    }
  });
  statStream.on('error', function(err) {
    callback(err);
  });
  statStream.on('end', function() {
    if (nbMigratedDocuments > 0) {
      console.log('  Finished: Added end date to' + nbMigratedDocuments + ' ' + name + ' stats');
    } else {
      console.log('  No ' + name + ' missing end date');
    }
    callback();
  });
}

mongoose.connection.on('open', function (err) {
  var db = mongoose.connection.db;
  ['checkhourlystats', 'checkdailystats', 'checkmonthlystats', 'taghourlystats', 'tagdailystats', 'tagmonthlystats'].forEach(function(collection) {
    migrateCheckStats(collection, db, function(err) {
      console.log('finished!');
    });
  });
  ['checkmonthlystats', 'tagmonthlystats'].forEach(function(collection) {
    addEndToMonthlyStat(collection, db, function(err) {
      console.log('finished!');
    });
  });
});