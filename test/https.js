var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('proxies https', function() {
  'use strict';

  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });


  it('when host is a String and includes \'https\' protocol', function(done) {
    var https = express();
    https.use(proxy('https://httpbin.org'));
    request(https)
      .get('/get?show_env=1')
      .end(function(err, res) {
        if (err) { return done(err); }
        assert(res.body.headers['X-Forwarded-Ssl'] === 'on');
        assert(res.body.headers['X-Forwarded-Protocol'] === 'https');
        done();
      });
  });

  it('https port 443', function(done) {
    var https = express();
    https.use(proxy('httpbin.org:443'));
    request(https)
      .get('/user-agent')
      .end(function(err) {
        if (err) { return done(err); }
        done();
      });
  });

  it('protocol is resolved correctly if host is function', function(done) {
    var https = express();
    https.use(proxy(function() { return 'https://httpbin.org'; }));
    request(https)
      .get('/get?show_env=1')
      .end(function(err, res) {
        if (err) { return done(err); }
        assert(res.body.headers['X-Forwarded-Ssl'] === 'on');
        assert(res.body.headers['X-Forwarded-Protocol'] === 'https');
        done();
      });
  });

  it('https with function for URL', function(done) {
    var https = express();
    https.use(proxy(function() { return 'httpbin.org'; }, {https: true}));
    request(https)
      .get('/user-agent')
      .end(function(err) {
        if (err) { return done(err); }
        done();
      });
  });
});
