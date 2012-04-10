Uptime Changelog
================

To be released, V1.2
--------------------
* Fixed failure to add check in the dashboard when the protocol wasn't set

2012-04-10, v1.1
----------------

* Add support for HTTPS checks
* Refactor poller class to allow adapter pattern. Opens the door for UDP, FTP, complete page... check types.
* Removed proxy configuration (now uses environment variables)