var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('host can be a dynamic function', function() {
  'use strict';

  this.timeout(10000);

  var app = express();
  var proxyApp = express();
  var randomPort = Math.floor(Math.random() * 10000);
  var proxyUrl = 'localhost:' + randomPort;

  app.use(function(req, res, next) {
    req.session = { 'dynamic_host': proxyUrl };
    next();
  });

  app.use('/proxy', proxy(function(req) {
    var sessionKey = 'dynamic_host';
    return req.session[sessionKey];
  }));

  proxyApp.get('/', function(req, res) {
    res.sendStatus(204);
  });
  proxyApp.listen(randomPort);

  it('can proxy with session value', function(done) {
    request(app)
      .get('/proxy')
      .expect(204, done);
  });
});
