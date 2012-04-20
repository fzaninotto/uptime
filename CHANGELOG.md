Uptime Changelog
================

To be released, v1.2
--------------------

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