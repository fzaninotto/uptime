uptime
======

A simple remote monitoring utility using Node.js and MongoDB.

<img src="https://github.com/downloads/fzaninotto/uptime/uptime.png" title="Uptime screenshot" />

Features
--------

* Monitor thousands of websites (powered by [Node.js asynchronous programming](http://dotheweb.posterous.com/nodejs-for-php-programmers-1-event-driven-pro))
* Tweak frequency of monitoring on a per-check basis, up to the millisecond
* Receive instant web alerts on every page when a check goes down (thanks [socket.io](http://socket.io/))
* Record availability statistics for further reporting (powered by [MongoDB](http://www.mongodb.org/))
* Detailed uptime reports with animated charts (powered by [Highcharts](http://www.highcharts.com/))
* Monitor availability, responsiveness, average response time , and total uptime/downtime
* Get details about failed checks (HTTP error code, etc.)
* Group checks by tags and get reports by tag
* Familiar web interface (powered by [Twitter Bootstrap 2.0](http://twitter.github.com/bootstrap/index.html))
* complete API for integration with third-party monitoring services
* Easy installation and zero administration

Installing Uptime
-----------------------

As for every Node.js application, the installation is straightforward:

    > git clone git://github.com/fzaninotto/uptime.git
    > npm install
    > node app.js

Adding Checks
-------------

By default, the web UI runs on port 8082, so just browse to 

    http://localhost:8082/

And you're ready to begin. Create your first check by entering an URL, wait for the first ping, and you'll soon see data flowing through your charts!

Configuring
-----------

Uptime uses [node-config](https://github.com/lorenwest/node-config) to allow YAML configuration and environment support. Here is the default configuration, taken from `config/default.yaml`:

    mongodb:
      server:   localhost
      database: uptime
      user:     root 
      password:

    monitor:
      pollingInterval:        10000      # ten seconds
      updateInterval:         60000      # one minute
      qosAggregationInterval: 600000     # ten minutes
      timeout:                5000       # five seconds
      pingHistory:            8035200000 # three months
      http_proxy:      

    server:
      port:     8082

To modify this configuration, create a `development.yaml` or a `production.yaml` file in the same directory, and override just the settings you need. For instance, to run Uptime on port 80 in production, create a `production.yaml` file as follows:

    server:
      port:     80

License
-------

Uptime is free to use and distribute, under the MIT license. See the bundled `LICENSE` file for details.

If you like the software, please help improving it by contributing PRs on the [GitHub project](https://github.com/fzaninotto/uptime)!

TODO
----

* Plugin system to allow extension (check types, action taken on a new event, etc)
* Decouple monitor and app, to avoid slowdown of checks when the dashboard is heavily browsed
* Allow email alerts in case of non-availability (not sure if this should be part of the lib)
* Account for scheduled maintenance (and provide two QoS calculations: with and without scheduled maintenance)
* Allow for JavaScript execution in the monitored resources by using a headless browser (probably zombie.js)
* Unit tests