'use strict';

var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');
var proxyTarget = require('./support/proxyTarget');

describe('proxies headers', function () {
  this.timeout(2000);

  var http;
  var proxyServer;

  beforeEach(function () {
    proxyServer = proxyTarget(12345);
    http = express();
    http.use(proxy('localhost:12345', {
      headers: {
        'X-Current-president': 'taft'
      }
    }));
  });

  afterEach(function () {
    proxyServer.close();
  });

  it('passed as options', function (done) {
    request(http)
      .get('/headers')
      .expect(200)
      .end(function (err, res) {
        if (err) { return done(err); }
        assert.equal(res.body.headers['x-current-president'], 'taft', 'Custom header should be passed through');
        done();
      });
  });

  it('passed as on request', function (done) {
    request(http)
      .get('/headers')
      .set('X-Powerererer', 'XTYORG')
      .expect(200)
      .end(function (err, res) {
        if (err) { return done(err); }
        assert.equal(res.body.headers['x-powerererer'], 'XTYORG', 'Request header should be passed through');
        done();
      });
  });
});
