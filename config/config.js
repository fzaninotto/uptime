var config = {
  all: {
    mongodbUser:     process.env.MONGODB_USER     || 'root',
    mongodbPassword: process.env.MONGODB_PASSWORD || '',
    mongodbServer:   process.env.MONGODB_SERVER   || 'localhost',
    mongodbDatabase: process.env.MONGODB_DATABASE || 'uptime',
    web_port:        process.env.WEB_PORT         || 8081
  },
  development: {
    
  },
  production: {
    
  }
}

module.exports = function() {
  var config_current = {};
  var config_all = config.all;
  for (var key in config_all) config_current[key] = config_all[key];
  var config_env = config[process.env.NODE_ENV];
  for (var key in config_env) config_current[key] = config_env[key];
  return config_current;
}();