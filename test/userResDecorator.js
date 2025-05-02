'use strict';

var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');
var proxyTarget = require('./support/proxyTarget');
var TIMEOUT = require('./constants');

describe('response decoration', function () {
describe('userResDecorator', function () {
  this.timeout(TIMEOUT.EXTENDED);
  var proxyServer;

  beforeEach(function () {
    proxyServer = proxyTarget(12345);
  });

  afterEach(async function () {
    await proxyServer.close();
  });

  describe('userResDecorator', function () {
    this.timeout(TIMEOUT.EXTENDED);


    describe('response transformation', function () {
      it('should transform JSON response', function (done) {
        var app = express();
        var handler = {
          method: 'get',
          path: '/data',
          fn: function(req, res) {
            res.json({ origin: '127.0.0.1' });
          }
        };
        proxyServer.close();
        proxyServer = proxyTarget(12345, 100, [handler]);

        app.use(proxy('localhost:12345', {
          userResDecorator: function (proxyRes, proxyResData) {
            var data = JSON.parse(proxyResData.toString('utf8'));
            data.intercepted = true;
            return JSON.stringify(data);
          }
        }));

        request(app)
          .get('/data')
          .end(function (err, res) {
            if (err) { return done(err); }
            assert(res.body.intercepted);
            done();
          });
      });

      it('should transform HTML response', function (done) {
        var app = express();
        var handler = {
          method: 'get',
          path: '/html',
          fn: function(req, res) {
            res.send('<!DOCTYPE html><html><body>Test page</body></html>');
          }
        };
        proxyServer.close();
        proxyServer = proxyTarget(12345, 100, [handler]);

        app.use(proxy('localhost:12345', {
          userResDecorator: function (targetResponse, data) {
            data = data.toString().replace('DOCTYPE', 'WINNING');
            return data;
          }
        }));

        request(app)
          .get('/html')
          .end(function (err, res) {
            if (err) { return done(err); }
            assert(res.text.indexOf('WINNING') > -1);
            done();
          });
      });
    });

    describe('response header modification', function () {
      it('should modify custom headers [deviant case, supported by pass-by-reference atm]', function (done) {
        var app = express();
        app.use(proxy('localhost:12345', {
          userResDecorator: function (rsp, data, req, res) {
            res.set('x-wombat-alliance', 'mammels');
            res.set('content-type', 'wiki/wiki');
            return data;
          }
        }));

        request(app)
          .get('/get')
          .end(function (err, res) {
            if (err) { return done(err); }
            assert.equal(res.headers['content-type'], 'wiki/wiki');
            assert.equal(res.headers['x-wombat-alliance'], 'mammels');
            done();
          });
      });
    });

    describe('asynchronous decoration', function () {
      it('should support Promise-based decoration', function (done) {
        var app = express();
        var handler = {
          method: 'get',
          path: '/promise',
          fn: function(req, res) {
            res.json({ origin: '127.0.0.1' });
          }
        };
        proxyServer.close();
        proxyServer = proxyTarget(12345, 100, [handler]);

        app.use(proxy('localhost:12345', {
          userResDecorator: function (proxyRes, proxyResData) {
            return new Promise(function (resolve) {
              const decoratedResponse = JSON.parse(proxyResData.toString());
              decoratedResponse.funkyMessage = 'oi io oo ii';
              setTimeout(function () {
                resolve(JSON.stringify(decoratedResponse));
              }, 200);
            });
          }
        }));

        request(app)
          .get('/promise')
          .end(function (err, res) {
            if (err) { return done(err); }
            assert.equal(res.body.origin, '127.0.0.1');
            assert.equal(res.body.funkyMessage, 'oi io oo ii');
            done();
          });
      });
    });

    describe('redirect handling', function () {
      it('should modify redirect location', function (done) {
        function redirectingServer(port, origin) {
          var app = express();
          app.get('/', function (req, res) {
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
          userResDecorator: function (rsp, data, req, res) {
            var proxyReturnedLocation = res.getHeaders ? res.getHeaders().location : res._headers.location;
            res.location(proxyReturnedLocation.replace(redirectingServerPort, preferredPort));
            return data;
          }
        }));

        request(proxyApp)
          .get('/')
          .expect(function (res) {
            res.headers.location.match(/localhost:3000/);
          })
          .end(function () {
            server.close();
            done();
          });
      });
    });
  });

  describe('special status codes', function () {
    it('should skip decoration for 304 responses', function (done) {
      var app = express();
      var slowTarget = express();
      slowTarget.use(function (req, res) { res.sendStatus(304); });
      var serverReference = slowTarget.listen(12346);

      app.use('/proxy', proxy('http://127.0.0.1:12346', {
        userResDecorator: function (/*res*/) {
          throw new Error('expected to never get here because this step should be skipped for 304');
        }
      }));

      request(app)
        .get('/proxy')
        .expect(304)
        .end(function (err) {
          serverReference.close();
          done(err);
        });
    });
  });

  describe('response access', function () {
    it('should have access to original response properties', function (done) {
      var app = express();
      app.use(proxy('localhost:12345', {
        userResDecorator: function (proxyRes, proxyResData) {
          assert(proxyRes.connection);
          assert(proxyRes.socket);
          assert(proxyRes.headers);
          assert(proxyRes.headers['content-type']);
          return proxyResData;
        }
      }));

      request(app).get('/get').then(() => done());
    });
  });

  describe('external response handling', function () {

    /*
     Github provided a unique situation where the encoding was different than
     utf-8 when we didn't explicitly ask for utf-8.  This test helped sort out
     the issue, and even though its a little too on the nose for a specific
     case, it seems worth keeping around to ensure we don't regress on this
     issue.
     */

    it('should handle GitHub response encoding correctly', function (done) {
      this.timeout(15000);
      var app = express();
      app.use(proxy('https://github.com/villadora/express-http-proxy', {
        userResDecorator: function (targetResponse, data) {
          data = data.toString().replace('DOCTYPE', 'WINNING');
          assert(data !== '');
          return data;
        }
      }));

      request(app)
        .get('/html')
        .end(function (err, res) {
          if (err) { return done(err); }
          assert(res.text.indexOf('WINNING') > -1);
          done();
        });
    });
  });
});

