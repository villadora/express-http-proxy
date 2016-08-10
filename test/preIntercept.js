var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('preIntercept', function() {
  'use strict';

  it('has access to original response', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      preIntercept: function(rsp) {
        assert(rsp.connection);
        assert(rsp.socket);
        assert(rsp.headers);
        assert(rsp.headers['content-type']);
        done();
      }
    }));

    request(app).get('/').end();
  });

  it('can modify the response headers', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      preIntercept: function(rsp) {
        rsp.headers['content-type'] = 'application/json';
      }
    }));

    request(app)
    .get('/ip')
    .end(function(err, res) {
      if (err) { return done(err); }
      assert(res.headers['content-type'] === 'application/json');
      done();
    });
  });
});


describe('test preIntercept on html response from github',function() {
  /*
     Github provided a unique situation where the encoding was different than
     utf-8 when we didn't explicitly ask for utf-8.  This test helped sort out
     the issue, and even though its a little too on the nose for a specific
     case, it seems worth keeping around to ensure we don't regress on this
     issue.
  */

  'use strict';

  it('is able to read and manipulate the response', function(done) {
    this.timeout(1500);  // give it some extra time to get response
    var app = express();
    app.use(proxy('https://github.com/villadora/express-http-proxy', {
      preIntercept: function(res) {
        var cookie = res.headers['set-cookie'];
        if (cookie) {
          // Make HTTPS -> HTTP proxying work correctly.
          if (Array.isArray(cookie)) {
            res.headers['set-cookie'] = cookie.map(function(item) {
              item.replace('secure; ', '');
            });
          }
          delete res.headers['strict-ransport-security'];
        }
      }
    }));

    request(app)
    .get('/html')
    .end(function(err, res) {
      if (err) { return done(err); }
      assert(res.headers['strict-ransport-security'] === undefined);
      done();
    });

  });
});

