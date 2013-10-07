uptime
======

A remote monitoring application using Node.js, MongoDB, and Twitter Bootstrap.

<img src="https://raw.github.com/fzaninotto/uptime/downloads/check_details.png" title="Visualizing the availability of an HTTP check in Uptime" width="50%" valign="top" />
<img src="https://raw.github.com/fzaninotto/uptime/downloads/check_form.png" title="Editing check attributes (polling interval, slow threshold, alert threshold, pattern to match, tags) in Uptime" width="50%" valign="top" />

You can watch a [demo screencast on Vimeo](https://vimeo.com/39302164).

Features
--------

* Monitor thousands of websites (powered by [Node.js asynchronous programming](http://redotheweb.com/2012/01/23/nodejs-for-php-programmers-1-event-driven-programming-and-pasta.html))
* Tweak frequency of monitoring on a per-check basis, up to the second
* Check the presence of a pattern in the response body
* Receive notifications whenever a check goes down
  * On screen (powered by [socket.io](http://socket.io/))
  * By email
  * On the console
* Record availability statistics for further reporting (powered by [MongoDB](http://www.mongodb.org/))
* Detailed uptime reports with animated charts (powered by [Flotr2](http://www.humblesoftware.com/flotr2/))
* Monitor availability, responsiveness, average response time, and total uptime/downtime
* Get details about failed checks (HTTP error code, etc.)
* Group checks by tags and get reports by tag
* Familiar web interface (powered by [Twitter Bootstrap 2.0](http://twitter.github.com/bootstrap/index.html))
* Complete API for integration with third-party monitoring services
* Powerful plugin system to ease extension and customization
* Easy installation and zero administration

Installing Uptime
-----------------

Uptime 3.2 requires Node.js 0.10 and MongoDB 2.1. Older versions provide compatibility with Node 0.8 (Uptime v3.1) and 0.6 (Uptime v1.4).

To install from GitHub, clone the repository and install dependencies using `npm`:

```sh
$ git clone git://github.com/fzaninotto/uptime.git
$ cd uptime
$ npm install
```

Lastly, start the application with:

```sh
$ node app
```

Upgrading From a 2.0 Install
----------------------------

If you have been using uptime 1.0 or 2.0, you have to execute the migration script before using the new release.

```sh
$ node models/migrations/upgrade2to3
```

Adding Checks
-------------

By default, the web UI runs on port 8082, so just browse to 

    http://localhost:8082/

And you're ready to begin. Create your first check by entering an URL, wait for the first ping, and you'll soon see data flowing through your charts!

Configuring
-----------

Uptime uses [node-config](https://github.com/lorenwest/node-config) to allow YAML configuration and environment support. Here is the default configuration, taken from `config/default.yaml`:

```yaml
mongodb:
  server:   localhost
  database: uptime
  user:     root 
  password:
  connectionString:       # alternative to setting server, database, user and password separately

monitor:
  name:                   origin
  apiUrl:                 'http://localhost:8082/api' # must be accessible without a proxy
  pollingInterval:        10000      # ten seconds
  timeout:                5000       # five seconds
  userAgent:              NodeUptime/2.0 (https://github.com/fzaninotto/uptime)

analyzer:
  updateInterval:         60000      # one minute
  qosAggregationInterval: 600000     # ten minutes
  pingHistory:            8035200000 # three months

autoStartMonitor: true

server:
  port:     8082

plugins:
  - ./plugins/console
  - ./plugins/patternMatcher
  - ./plugins/httpOptions
  # - ./plugins/email
```

To modify this configuration, create a `development.yaml` or a `production.yaml` file in the same directory, and override just the settings you need. For instance, to run Uptime on port 80 in production, create a `production.yaml` file as follows:

```yaml
server:
  port:     80
```

Node that Uptime works great behind a proxy - it uses the `http_proxy` environment variable transparently.

Architecture
------------

Uptime is composed of two services: a webapp (in `app.js`), and a polling monitor (in `monitor.js)`. For your convenience, the two services start together when you call `node app`.

<img src="https://raw.github.com/fzaninotto/uptime/downloads/architecture.png" title="Uptime architecture" />

However, heavily browsing the webapp may slow down the whole server - including the polling monitor. In other terms, using the application can influence the uptime measurements. To avoid this effect, it is recommended to run the polling monitor in a separate process.

To that extent, set the `autoStartMonitor` setting to `false` in the `production.yaml`, and launch the monitor by hand:

```sh
$ node monitor &
$ node app
```

You can also run the monitor in a different server. This second server must be able to reach the API of the webapp server: set the `monitor.apiUrl` setting accordingly in the `production.yaml` file of the monitor server.

Monitoring From Various Locations
---------------------------------

You can even run several monitor servers in several datacenters to get average response time. In that case, make sure you set a different `monitor.name` setting for all monitor servers to be able to tell which server make a particular ping.

Using Plugins
-------------

Plugins can add more notification types, more poller types, new routes to the webapp, etc. Uptime currently bundles three plugins:

 * [`console`](https://github.com/fzaninotto/uptime/blob/master/plugins/console/index.js): log pings and events in the console in real time
 * [`email`](https://github.com/fzaninotto/uptime/blob/master/plugins/email/index.js): notify events (up, down pause) by email
 * [`patternMatcher`](https://github.com/fzaninotto/uptime/blob/master/plugins/patternMatcher/index.js): allow HTTP & HTTPS pollers to test the response body against a pattern
 * [`httpOptions`](https://github.com/fzaninotto/uptime/blob/master/plugins/httpOptions/index.js): add custom HTTP options and headers to HTTP and HTTPS checks (e.g. to allow self-signed certificate on HTTPS, custom headers, custom HTTP methods, ...)
 * [`basicAuth`](https://github.com/fzaninotto/uptime/blob/master/plugins/basicAuth/index.js): add HTTP Basic Access Authentication to the dashboard and API applications

To enable plugins, just add a line to the `plugins:` section of the configuration file.
Three of the bundled plugins are already enabled by default:

```yaml
# in config/default.yaml
plugins:
  - ./plugins/console
  - ./plugins/patternMatcher
  - ./plugins/httpOptions
  # - ./plugins/email
  # - ./plugins/basicAuth
```

You can override these settings in your environment configuration, for instance:

```yaml
# in config/production.yaml
# disable the console plugin and enable the email plugin
plugins:
  # - ./plugins/console
  - ./plugins/patternMatcher
  - ./plugins/httpOptions
  - ./plugins/email
  # - ./plugins/basicAuth
```

Third-party plugins:

 * [`webhooks`](https://github.com/mintbridge/uptime-webhooks): notify events to an URL by sending an HTTP POST request 
 * [`campfire`](https://gist.github.com/dmathieu/5592418): notify events to Campfire
 * [`pushover`](https://gist.github.com/xphyr/5994345): Notify events to mobile devices

Writing Plugins
---------------

A plugin is a simple Node.js module which hooks into predefined extension points. Uptime automatically requires plugin modules when starting the webapp and the monitor, and tries to call the two following functions:

* `initWebApp(options)` when starting the webapp
* `initMonitor(options)` when starting the monitor

Check the [app.js](https://github.com/fzaninotto/uptime/blob/master/app.js#L97) and [monitor.js](https://github.com/fzaninotto/uptime/blob/master/monitor.js#L8) to see a detail of the options passed to each hook. Also, check the code of existing plugins to understand how they can add new pollers, new notification types, etc.

For instance, if you had to recreate a simple version of the `console` plugin, you could write it as follows:

```js
// in plugins/console/index.js
var CheckEvent = require('../../models/checkEvent');
exports.initWebapp = function() {
  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      console.log(new Date() + check.name + checkEvent.isGoDown ? ' goes down' : ' goes back up');
    });
  });
}
```

All Uptime entities emit lifecycle events that you can listen to on the Model class. These events are `beforeInsert`, `afterInsert`, `beforeUpdate`, `afterUpdate`, `beforeSave` (called for both inserts and updates), `afterSave` (called for both inserts and updates), `beforeRemove`, and `afterRemove`. For more information about these events, check the [mongoose-lifecycle](https://github.com/fzaninotto/mongoose-lifecycle) plugin.

Support and Discussion
----------------------

Join the [node-uptime](https://groups.google.com/d/forum/node-uptime) Google Group to discuss features, bugs and use cases related to Uptime.

License
-------

The Uptime code is free to use and distribute, under the [MIT license](https://raw.github.com/fzaninotto/uptime/master/LICENSE).

Uptime uses third-party libraries:

* [NodeJS](http://nodejs.org/), licensed under the [MIT License](https://github.com/joyent/node/blob/master/LICENSE#L5-22),
* [Socket.io](http://socket.io/), licensed under the [MIT License](https://github.com/LearnBoost/socket.io/blob/master/Readme.md),
* [MongooseJS](http://mongoosejs.com/), licensed under the [MIT License](https://github.com/LearnBoost/mongoose/blob/master/README.md),
* [jQuery](http://jquery.com/), licensed under the [MIT License](http://jquery.org/license),
* [TwitterBootstrap](http://twitter.github.com/bootstrap/), licensed under the [Apache License v2.0](http://www.apache.org/licenses/LICENSE-2.0),
* [Flotr2](http://www.humblesoftware.com/flotr2/), licensed under the [MIT License](https://github.com/HumbleSoftware/Flotr2/blob/master/LICENSE).
* [Favicon](http://www.alexpeattie.com/projects/justvector_icons/), distributed under the [Free Art License](http://artlibre.org/licence/lal/en).

If you like the software, please help improving it by contributing PRs on the [GitHub project](https://github.com/fzaninotto/uptime)!

TODO
----

* Account for scheduled maintenance (and provide two QoS calculations: with and without scheduled maintenance)
* Allow for JavaScript execution in the monitored resources by using a headless browser (probably zombie.js)
* Unit tests
