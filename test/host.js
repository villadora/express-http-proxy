'use strict';

var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('host can be a dynamic function', function() {

  this.timeout(10000);

  var app = express();
  describe('and it can be memoized', function () {
      var firstProxyApp = express();
      var secondProxyApp = express();
      // TODO: This seems like a bug factory.  We will have intermittent port conflicts, yeah?
      var firstPort = Math.floor(Math.random() * 10000);
      var secondPort = Math.floor(Math.random() * 10000);

      app.use('/proxy/:port', proxy(function(req) {
        return 'localhost:' + req.params.port;
      }, {
        memoizeHost: false
      }));

      firstProxyApp.get('/', function(req, res) {
        res.sendStatus(204);
      });
      firstProxyApp.listen(firstPort);

      secondProxyApp.get('/', function(req, res) {
        res.sendStatus(200);
      });
      secondProxyApp.listen(secondPort);

      it('when not memoized, host resolves to a second value on the seecond call', function(done) {
        request(app)
          .get('/proxy/' + firstPort)
          .expect(204)
          .end(function(err) {
            if (err) {
              return done(err);
            }
            request(app)
                .get('/proxy/' + secondPort)
                .expect(200, done);
          });
      });
  });
});
