#!/bin/bash

node test/server.js &
node test/waitForServer.js
node --allow-natives-syntax node_modules/mocha/bin/_mocha test/test.js
node test/killServer.js
