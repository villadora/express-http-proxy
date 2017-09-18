'use strict';

var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('when userResHeaderDecorator is defined', function() {

  this.timeout(10000);

  var app, serverReference;

  afterEach(function() {
    serverReference.close();
  });

  beforeEach(function() {
    app = express();
    var pTarget = express();
    pTarget.use(function(req, res) { res.json(req.headers); });
    serverReference = pTarget.listen(12345);
  });

  afterEach(function() {
    serverReference.close();
  });

  it('provides an interface for updating headers', function(done) {

    app.use('/proxy', proxy('http://127.0.0.1:12345', {
      userResHeaderDecorator: function(headers /*, userReq, userRes, proxyReq, proxyRes */) {
        headers.boltedonheader = 'franky';
        return headers;
      }
    }));

    app.use(function(req, res) {
      res.sendStatus(200);
    });

    request(app)
      .get('/proxy')
      .expect(function(res) {
        assert(res.headers.boltedonheader === 'franky');
      })
      .end(done);
  });
});
