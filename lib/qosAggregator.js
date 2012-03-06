var QosAggregator = function() {
};

QosAggregator.prototype.reduce = function(key, values) {
  var result = { count: 0, ups: 0, responsives: 0, time: 0, downtime: 0 };
  values.forEach(function(value) {
    result.count       += value.count;
    result.ups         += value.ups;
    result.responsives += value.responsives;
    result.time        += value.time;
    result.downtime    += value.downtime;
  });
  return result;
};

QosAggregator.prototype.getQosForPeriod = function(collection, mapFunction, start, end, callback) {
  collection.mapReduce(
    mapFunction.toString(),
    this.reduce.toString(),
    { query: { timestamp: { $gte: start, $lte: end } }, out: { inline: 1 } },
    callback
  );
};

module.exports = new QosAggregator();