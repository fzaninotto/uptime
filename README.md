uptime
======

A simple remote monitoring utility using node.js and MongoDB.

Install
-------

    > npm install

Configure
---------

You must configure the connection settings to the MongoDB database.

You must also add target URIs to monitor. For now, this happens directly in the mongo database:

    > mongo uptime
    > db.targets.save({url: 'http://www.google.com/index.html', timeout: 1000})
    > db.targets.save({url: 'http://www.yahoo.com/', timeout: 5000})

Run
---

    > node app.js
