uptime
======

A simple remote monitoring utility using node.js and MongoDB.

Installing Dependencies
-----------------------

Uptime requires [Mongoose](http://mongoosejs.com/), a JavaScript ODM for MongoDB. To install all dependencies in one command, use the Node Package Manager:

    > npm install

Configuring
-----------

You must configure the connection settings to the MongoDB database.

You must also add URIs to check. For now, this must be done directly in the mongo database, using the MongoDB interactive shell `mongo`:

    > mongo uptime
    connecting to: uptime
    > db.checks.save({ name: 'Google', url: 'http://www.google.com/index.html', maxTime: 1000 })
    > db.checks.save({ name: 'Yahoo',  url: 'http://www.yahoo.com/', maxTime: 5000})

Running the Uptime Monitor
--------------------------

Just start the application using the `node` command:

    > node app.js

As of now, this starts the polling of all checks and the calculation of their quality of service on the past 24 hours.

TODO
----

* Create a web API
* Create a web GUI
* Keep QoS history in checks (month per month)
* Cleanup old pings automatically to save disk space
* Allow email alerts in case of non-availability (not sure if this should be part of the lib)
* Account for scheduled maintenance (and provide two QoS calculations: with and without scheduled maintenance)
* Allow for JavaScript execution in the monitored resources by using a headless browser (probably zombie.js)
