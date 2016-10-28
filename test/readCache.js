var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');
var promise = require('es6-promise');


describe('readCache', function() {
  'use strict';
  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });

  it('should provide a cached response as though it came from the host', function(done) {
      app = express();
      app.use(proxy('httpbin.org',{
          readCache: function() {
            return new promise.Promise(function(resolve) {
              resolve({
                headers: {
                    'x-president': 'Obama'
                  },
                statusCode: 200,
                data: {
                    isCached: 'yes'
                  }
              });
            });
          }
        }));
      request(app)
      .get('/get')
      .end(function(err, res) {
        if (err) { return done(err); }
        assert(res.header['x-president'],'Obama');
        assert.equal(res.body.isCached, 'yes');
        done(err);
      });
    });
});
