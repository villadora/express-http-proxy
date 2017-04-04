var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('host can be a dynamic function', function() {
  'use strict';

  this.timeout(10000);

  var app = express();
  var firstProxyApp = express();
  var secondProxyApp = express();
  var firstPort = 10001;
  var secondPort = 10002;

  app.use('/proxy/:port', proxy(function(req) {
    return 'localhost:' + req.params.port;
  }, {
    memoizeHost: false
  }));

  firstProxyApp.use('/', function(req, res) {
    res.sendStatus(204);
  });
  firstProxyApp.listen(firstPort);

  secondProxyApp.use('/', function(req, res) {
    res.sendStatus(200);
  });
  secondProxyApp.listen(secondPort);

  it('can proxy with session value', function(done) {
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
