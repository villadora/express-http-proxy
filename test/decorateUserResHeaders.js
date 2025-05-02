'use strict';

var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('when userResHeaderDecorator is defined', function () {

  this.timeout(10000);

  var app;
  var  serverReference;

  afterEach(function () {
    serverReference.close();
  });

  beforeEach(function () {
    app = express();
    var pTarget = express();
    pTarget.use(function (req, res) {
      res.header('x-my-not-so-secret-header', 'minnie-mouse');
      res.header('x-my-secret-header', 'mighty-mouse');
      res.json(req.headers);
    });
    serverReference = pTarget.listen(12345);
  });

  afterEach(function () {
    serverReference.close();
  });

  it('can delete a header', function (done) {
    app.use('/proxy', proxy('http://127.0.0.1:12345', {
      userResHeaderDecorator: function (headers /*, userReq, userRes, proxyReq, proxyRes */) {
        delete headers['x-my-secret-header'];
        return headers;
      }
    }));

    app.use(function (req, res) {
      res.sendStatus(200);
    });

    request(app)
      .get('/proxy')
      .expect(function (res) {
        assert(Object.keys(res.headers).indexOf('x-my-not-so-secret-header') > -1);
        assert(Object.keys(res.headers).indexOf('x-my-secret-header') === -1);
      })
      .end(done);
  });

  it('provides an interface for updating headers', function (done) {
    app.use('/proxy', proxy('http://127.0.0.1:12345', {
      userResHeaderDecorator: function (headers /*, userReq, userRes, proxyReq, proxyRes */) {
        headers.boltedonheader = 'franky';
        return headers;
      }
    }));

    app.use(function (req, res) {
      res.sendStatus(200);
    });

    request(app)
      .get('/proxy')
      .expect(function (res) {
        assert(res.headers.boltedonheader === 'franky');
      })
      .end(done);
  });

  it('author has option to copy proxyResponse headers to userResponse', function (done) {
    app.use('/proxy', proxy('http://127.0.0.1:12345', {
      userResHeaderDecorator: function (headers, userReq) { // proxyReq
        // Copy specific headers from the proxy request to the user response
        //
        // We can copy them to new name
        if (userReq.headers['x-custom-header']) {
          headers['x-proxied-custom-header'] = userReq.headers['x-custom-header'];
        }
        if (userReq.headers['x-user-agent']) {
          headers['x-proxied-user-agent'] = userReq.headers['x-user-agent'];
        }

        // We can copy them to the same name
        headers['x-copied-header-1'] = userReq.headers['x-copied-header-1'];
        headers['x-copied-header-2'] = userReq.headers['x-copied-header-2'];
        return headers;
      }
    }));

    request(app)
      .get('/proxy')
      .set('x-custom-header', 'custom-value')
      .set('x-user-agent', 'test-agent')
      .set('x-copied-header-1', 'value1')
      .set('x-copied-header-2', 'value2')
      .expect(function (res) {
        // Verify the original headers were proxied to the response
        assert.equal(res.headers['x-proxied-custom-header'], 'custom-value');
        assert.equal(res.headers['x-proxied-user-agent'], 'test-agent');
        assert.equal(res.headers['x-copied-header-1'], 'value1');
        assert.equal(res.headers['x-copied-header-2'], 'value2');
      })
      .end(done);
  });
});
