'use strict';

var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');
var bodyParser = require('body-parser');


function createLocalApplicationServer() {
  var app = express();
  return app;
}

function createProxyApplicationServer() {
  var pTarget = express();
  pTarget.use(bodyParser.json());
  pTarget.use(bodyParser.urlencoded({ extended: true }));
  pTarget.use(function (req, res) {
    assert(req.body.name === 'tobi'); //, 'Assert that the value posted to the local server is passed to the proxy');
    res.json(req.body);
  });
  return pTarget.listen(12345);
}

describe('when proxy request is a POST', function () {

  this.timeout(10000);

  var localServer;
  var  proxyServer;

  beforeEach(function () {
    localServer = createLocalApplicationServer();
    proxyServer = createProxyApplicationServer();
  });

  afterEach(function () {
    proxyServer.close();
  });

  var testCases = [
    { name: 'form encoded', encoding: 'application/x-www-form-urlencoded' },
    { name: 'JSON encoded', encoding: 'application/json' }
  ];

  testCases.forEach(function (test) {
    it('should deliver the post body when ' + test.name, function (done) {

      localServer.use('/proxy', proxy('http://127.0.0.1:12345'));
      localServer.use(function (req, res) { res.sendStatus(200); });
      localServer.use(function (err, req, res, next) { throw new Error(err, req, res, next); });

      request(localServer)
        .post('/proxy')
        .send({ name: 'tobi' })
        .set('Content-Type', test.encoding)
        .expect(function (res) {
          assert(res.body.name === 'tobi');
        })
        .end(done);
    });
  });

});
