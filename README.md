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

You must also add target URIs to monitor. For now, this must be done directly in the mongo database, using the MongoDB interactive shell `mongo`:

    > mongo uptime
    connecting to: uptime
    > db.targets.save({ name: 'Google', url: 'http://www.google.com/index.html', timeout: 1000 })
    > db.targets.save({ name: 'Yahoo',  url: 'http://www.yahoo.com/', timeout: 5000})

Running the Uptime Monitor
--------------------------

Just start the application using the `node` command:

    > node app.js

As of now, this starts the polling of all targets and the calculation of their quality of servcie on the past 24 hours.

TODO
----

* Create a web API
* Create a web GUI
* Distinguish between availability and performance
* Keep QoS history in targets (month per month)
* Cleanup old pings automatically to save disk space
* Allow email alerts in case of non-availability (not sure if this should be part of the lib)
* Account for scheduled maintenance (and provide two QoS calculations: with and without scheduled maintenance)