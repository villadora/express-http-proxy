'use strict';

var assert = require('assert');
var express = require('express');
var http = require('http');
var startProxyTarget = require('./support/proxyTarget');
var proxy = require('../');

function fakeProxyServer({path, port, response}) {
  var proxyRouteFn = [{
    method: 'get',
    path: path,
    fn: function (req, res) {
      res.write(response);
      res.end();
    }
  }];

  return startProxyTarget(port, 1000, proxyRouteFn);
}

function simulateUserRequest() {
  return new Promise(function (resolve, reject) {

    var req = http.request({ hostname: 'localhost', port: 8308, path: '/' }, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk.toString()); });
      res.on('end', function () { resolve(chunks); });
    });

    req.on('error', function (e) {
      reject('problem with request:', e.message);
    });

    req.end();
  })
}

describe('handle multiple proxies in the same runtime', function () {
  this.timeout(3000);

  var server;
  var  targetServer, targetServer2;

  beforeEach(function () {
    targetServer = fakeProxyServer({path:'/', port: '8309', response: '8309_response'});
    targetServer2 = fakeProxyServer({path: '/', port: '8310', response: '8310_response'});
  });

  afterEach(function () {
    server.close();
    targetServer.close();
    targetServer2.close();
  });


  describe("When two distinct proxies are defined for the global route", () => {
    afterEach(() => server.close())

    it('the first proxy definition should be used if it succeeds', function (done) {
      var app = express();
      app.use(proxy('http://localhost:8309', {}));
      app.use(proxy('http://localhost:8310', {}));
      server = app.listen(8308)
      simulateUserRequest()
        .then(function (res) {
          assert.equal(res[0], '8309_response');
          done();
        })
        .catch(done);
    });

    it('the fall through definition should be used if the prior skipsToNext', function (done) {
      var app = express();
      app.use(proxy('http://localhost:8309', {
        skipToNextHandlerFilter: () => { return true } // no matter what, reject this proxy request, and call next()
      }));
      app.use(proxy('http://localhost:8310'))
      server = app.listen(8308)
      simulateUserRequest()
        .then(function (res) {
          assert.equal(res[0], '8310_response');
          done();
        })
        .catch(done);
    });
  })
});
