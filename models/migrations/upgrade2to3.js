var async    = require('async');
var moment   = require('moment');
var mongoose = require('../../bootstrap');
var db       = mongoose.connection.db;
var CheckHourlyStat = require('../../models/checkHourlyStat');
var Tag      = require('../../models/tag');
var QosAggregator = require('../../lib/qosAggregator');

var migrateCheckStats = function(name, callback) {
  var nbMigratedDocuments = 0;
  var collection = db.collection(name);
  var statStream = collection.find().stream();
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
    collection.update({ _id: stat._id }, { $set: newStat, $unset: unset }, {}, function() {});
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
};

var addEndToMonthlyStat = function(name, callback) {
  var nbMigratedDocuments = 0;
  var collection = db.collection(name);
  var statStream = collection.find().stream();
  statStream.on('data', function(stat) {
    if (stat.end) {
      // already merged
      return;
    }
    var end = moment(stat.timestamp).endOf('month').toDate();
    collection.update({ _id: stat._id }, { $set: { end: end } }, {}, function() {});
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
};

var getOldestDate = function(callback) {
  CheckHourlyStat
  .find()
  .sort({ 'timestamp': 1 })
  .findOne(function(err, stat) {
    return callback(err, stat ? stat.timestamp.valueOf() : null);
  });
};

var updateMonthlyQos = function(start, callback) {
  var date = Date.now() + 28 * 24 * 60 * 60 * 1000;
  var nbDates = 0;
  async.whilst(
    function() { date -= 28 * 24 * 60 * 60 * 1000; return date > start; },
    function(cb) {
      var dateObject = new Date(date);
      QosAggregator.updateMonthlyQos(dateObject, cb);
      nbDates++;
      console.log('Computing monthly stats for ' + dateObject.toUTCString());
    },
    callback
  );
};

var updateYearlyQos = function(start, callback) {
  var date = Date.now() + 365 * 24 * 60 * 60 * 1000;
  var nbDates = 0;
  async.whilst(
    function() { date -= 365 * 24 * 60 * 60 * 1000; return date > start; },
    function(cb) {
      var dateObject = new Date(date);
      QosAggregator.updateYearlyQos(dateObject, cb);
      nbDates++;
      console.log('Computing yearly stats for ' + dateObject.getFullYear());
    },
    callback
  );
};

var ensureTagsHaveFirstTestedDate = function(callback) {
  console.log('Updating tags for firstTested date');
  Tag.ensureTagsHaveFirstTestedDate(callback);
};

mongoose.connection.on('open', function(err) {
  if (err) return console.error(err);
  getOldestDate(function (err, oldestDate) {
    if (err) return console.error(err);
    async.series([
      function(next) {
        async.forEach(['checkhourlystats', 'checkdailystats', 'taghourlystats', 'tagdailystats'], migrateCheckStats, next);
      },
      function(next) {
        async.forEach(['checkmonthlystats', 'tagmonthlystats'], addEndToMonthlyStat, next);
      },
      function(next) {
        updateMonthlyQos(oldestDate, next);
      },
      function(next) {
        updateYearlyQos(oldestDate, next);
      },
      ensureTagsHaveFirstTestedDate,
      QosAggregator.updateLast24HoursQos.bind(QosAggregator)
    ], function(err2) {
      if (err2) return console.error(err2);
      console.log('Successfully migrated ' + db.databaseName + ' database');
      setTimeout(function() { mongoose.connection.close(); }, 1000);
    });
  });
});
