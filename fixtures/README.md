How To Create Fixtures
======================

If you want to play with actual data, use the following scripts to create checks, pings, and compute the aggregated statistics for these test checks over the last month.

    > node fixtures/populate.js
    > node fixtures/computeStats.js

Then, before using the dashboard, turn on the dummy target.

    > node fixtures/dummyTarget.js

It's a simple server that responds to the fixture pings with a quality of service determined by the URL. For instance, 

    http://localhost:8888/90

will return HTTP status 200 90% of the time, and HTTP status 500 the rest of the time.
