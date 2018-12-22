'use strict';

var debug = require('debug');
var express = require('express');
var request = require('supertest');
var proxy = require('../');
var proxyTarget = require('../test/support/proxyTarget');

/*  This test is specifically written because of critical errors thrown while debug logging. */
describe.only('trace debugging does not cause the application to fail', function () {
  var proxyServer;

  beforeEach(function () { debug.enable('express-http-proxy'); proxyServer = proxyTarget(3000); });
  afterEach(function () { debug.disable('express-http-proxy'); proxyServer.close(); });

  it('happy path', function (done) {
    var app = express();
    app.use(proxy('localhost:3000'));
    request(app)
      .get('/get')
      .expect(200)
      .end(done);
  });

  it('when agent is a deeply nested object', function (done) {
    var app = express();
    var HttpAgent = require('http').Agent;
    var httpAgent = new HttpAgent({ keepAlive: true, keepAliveMsecs: 60e3 });
    app.use(proxy('localhost:3000', {
      proxyReqOptDecorator: function (proxyReqOpts) {
        proxyReqOpts.agent = httpAgent;
        return proxyReqOpts;
      }
    }));
    request(app)
      .get('/get')
      .expect(200)
      .end(done);
  });
});

