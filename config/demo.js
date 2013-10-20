// demo.js

module.exports = {
  mongodb: {
    user:     process.env.MONGOLAB_USERNAME,
    password: process.env.MONGOLAB_PASSWORD,
    connectionString: process.env.MONGOLAB_URI
  },
  monitor: {
	apiUrl: process.env.UPTIME_API_URL  
  },
  verbose: false
}
