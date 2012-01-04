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
    > db.targets.save({url: 'http://www.google.com/index.html', timeout: 1000})
    > db.targets.save({url: 'http://www.yahoo.com/', timeout: 5000})

Running the Uptime Monitor
--------------------------

Just start the application using the `node` command:

    > node app.js
