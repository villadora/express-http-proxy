var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('intercept', function() {
  'use strict';

  it('has access to original response', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      intercept: function(rsp) {
        assert(rsp.connection);
        assert(rsp.socket);
        assert(rsp.headers);
        assert(rsp.headers['content-type']);
        done();
      }
    }));

    request(app).get('/').end();
  });

  it('can modify the response data', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      intercept: function(rsp, data, req, res, cb) {
        data = JSON.parse(data.toString('utf8'));
        data.intercepted = true;
        cb(null, JSON.stringify(data));
      }
    }));

    request(app)
    .get('/ip')
    .end(function(err, res) {
      if (err) { return done(err); }
      assert(res.body.intercepted);
      done();
    });
  });


  it('can mutuate an html response', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      intercept: function(rsp, data, req, res, cb) {
        data = data.toString().replace('Oh', '<strong>Hey</strong>');
        assert(data !== '');
        cb(null, data);
      }
    }));

    request(app)
    .get('/html')
    .end(function(err, res) {
      if (err) { return done(err); }
      assert(res.text.indexOf('<strong>Hey</strong>') > -1);
      done();
    });
  });

  it('can change the location of a redirect', function(done) {

    function redirectingServer(port, origin) {
      var app = express();
      app.get('/', function(req, res) {
        res.status(302);
        res.location(origin + '/proxied/redirect/url');
        res.send();
      });
      return app.listen(port);
    }

    var redirectingServerPort = 8012;
    var redirectingServerOrigin = ['http://localhost', redirectingServerPort].join(':');

    var server = redirectingServer(redirectingServerPort, redirectingServerOrigin);

    var proxyApp = express();
    var preferredPort = 3000;

    proxyApp.use(proxy(redirectingServerOrigin, {
      intercept: function(rsp, data, req, res, cb) {
        var proxyReturnedLocation = res._headers.location;
        res.location(proxyReturnedLocation.replace(redirectingServerPort, preferredPort));
        cb(null, data);
      }
    }));

    request(proxyApp)
    .get('/')
    .expect(function(res) {
      res.headers.location.match(/localhost:3000/);
    })
    .end(function() {
      server.close();
      done();
    });
  });
});
