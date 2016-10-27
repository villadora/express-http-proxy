var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('writeCache', function() {
  'use strict';
  this.timeout(10000);

  var app;

  it('should receive the request and cache data', function(done) {
      app = express();
      app.use(proxy('httpbin.org',{
          cacheWrite: function (req,cacheData) {
            assert.equal (cacheData.data.url,'http://httpbin.org/get');
            assert.equal (cacheData.headers['Content-Type'], 'application/json');
            assert.equal (cacheData.status,'200');
          }
      }));
    request(app)
      .get('/get')
      .end(function(err, res) {
        if (err) { return done(err); }
        assert(/node-superagent/.test(res.body.headers['User-Agent']));
        assert.equal(res.body.url, 'http://httpbin.org/get');
        done(err);
      });
  });
});
