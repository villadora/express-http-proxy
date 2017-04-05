var express = require('express');
var request = require('supertest');
var proxy = require('../');
var proxyTarget = require('./support/proxyTarget');

describe('honors timeout option', function() {
  'use strict';

  var other, http;
  beforeEach(function() {
    http = express();
    other = proxyTarget(8080, 1000, [{
      method: 'get',
      path: '/',
      fn: function(req, res) { res.sendStatus(200); }
    }]);
  });

  afterEach(function() {
    other.close();
  });

  function assertSuccess(server, done) {
    request(http)
      .get('/')
      .expect(200)
      .end(done);
  }

  function assertConnectionTimeout(server, done) {
    request(http)
      .get('/')
      .expect(408)
      .expect('X-Timout-Reason', 'express-http-proxy timed out your request after 100 ms.')
      .end(function() {
        done();
      });
  }

  describe('when timeout option is set lower than server response time', function() {
    it('should fail with CONNECTION TIMEOUT', function(done) {

      http.use(proxy('http://localhost:8080', {
        timeout: 100,
      }));

      assertConnectionTimeout(http, done);
    });
  });

  describe('when timeout option is set higher than server response time', function() {
    it('should succeed', function(done) {

      http.use(proxy('http://localhost:8080', {
        timeout: 1200,
      }));

      assertSuccess(http, done);
    });
  });

});
