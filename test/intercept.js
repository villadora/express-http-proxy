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


  it('can modify the response headers', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      intercept: function(rsp, data, req, res, cb) {
        res.set('x-wombat-alliance', 'mammels');
        res.set('content-type', 'wiki/wiki');
        cb(null, data);
      }
    }));

    request(app)
    .get('/ip')
    .end(function(err, res) {
      if (err) { return done(err); }
      assert(res.headers['content-type'] === 'wiki/wiki');
      assert(res.headers['x-wombat-alliance'] === 'mammels');
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


describe('test intercept on html response from github',function() {
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
      intercept: function(targetResponse, data, req, res, cb) {
        data = data.toString().replace('DOCTYPE','WINNING');
        assert(data !== '');
        cb(null, data);
      }
    }));

    request(app)
    .get('/html')
    .end(function(err, res) {
      if (err) { return done(err); }
      assert(res.text.indexOf('WINNING') > -1);
      done();
    });

  });
});

