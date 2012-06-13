Uptime Changelog
================

To be released, v1.3
--------------------

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