Uptime Changelog
================

2012-12-07, v3.0
----------------

* Uptime bars
* Exact availability calculation
* New stats page and date navigation
* Replaced Highcharts by Flotr2 for charts. No more licence problem!
* Upgraded to Twitter Bootstrap V2
* Many tweaks in the GUI
* Heavy refactoring

2012-12-07, v2.0
----------------

* Moved Mongo initialization to a dedicated bootstrap file
* Added support for setting the full MongoDB connection string in the config file
* Fixed engine requirement in package.json
* Updated Node poller user agent version
* Fixed console plugin
* Fixed fixtures to let them generate CheckEvents
* Fixed pings list not refreshing live in dashboard

2012-09-19, v2.0rc0
-------------------

* Upgraded Node.js to 0.8
* Bumped main dependencies (Express and Mongoose) to v3. This lead to some refactoring in the model classes.
* Switched to local jQuery to avoid networking issue

2012-09-19, v1.4
----------------

* This is the last release compatible with Node 0.6.
* New events appear as such when watching event list
* Added favicon. The favison turns red when at least one check is down.

2012-08-05, v1.3
----------------

* Added a User-Agent header to both http and https pollers, to identify pings from the monitor in server logs; you can override the header via configuration
* Fixed "Save and add" redirection
* Made check title optional (falls back to the url)
* Fixed handling of relative Location headers
* Fixed chart timezone and vertical scale bugs
* Made new events more apparent in the navbar, and in the events page
* Removed custom date display logic and added [moment.js](http://momentjs.com/) as a dependency.
* Fixed check when http redirects to https
* Removed lifecycleEventsPlugin and added [mongoose-lifecycle](https://github.com/fzaninotto/mongoose-lifecycle) module as a dependency. This change renames events on Mongoose models from 'pre-' to 'before-' and from 'post-' to 'after-' (e.g. 'postRemove' becomes 'afterRemove').
* Modified API routes to be more RESTful
* Upgraded dependencies (mongoose, express, ejs, config, async, socket.io)
* Added a Reports tab for tags, offering easily accessible monthly reports
* Made tabs compatible with direct links and back button in tag and check view

2012-04-21, v1.2
----------------

* Ping list is now updated in real time
* Added 'Save and add' button in new check form to facilitate batch check creation
* Changed the CheckEvent format for better extensibility (use the fixtures/fixEvents.js fix to migrate existing events)
* Fix polling interval to mimic the behavior of a cron
* Add a way to pause checks in the dashboard GUI, in the API, and in the model
* Split Monitor class and configuration, to fix polling when `autoStartMonitor` is false
* Fixed failure to add check in the dashboard when the protocol wasn't set
* Added UDP poller (bolgovr)

2012-04-10, v1.1
----------------

* Add support for HTTPS checks
* Refactor poller class to allow adapter pattern. Opens the door for UDP, FTP, complete page... check types.
* Removed proxy configuration (now uses environment variables)

2012-03-28, v1.0
----------------

* Initial version