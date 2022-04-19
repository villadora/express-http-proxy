'use strict';

var assert = require('assert');
var express = require('express');
var http = require('http');
var startProxyTarget = require('./support/proxyTarget');
var proxy = require('../');

function chunkingProxyServer() {
  var proxyRouteFn = [{
    method: 'get',
    path: '/stream',
    fn: function (req, res) {
      res.write('0');
      setTimeout(function () { res.write('1'); }, 100);
      setTimeout(function () {  res.write('2'); }, 200);
      setTimeout(function () { res.write('3'); }, 300);
      setTimeout(function () { res.end(); }, 500);
    }
  }];

  return startProxyTarget(8309, 1000, proxyRouteFn);
}

function simulateUserRequest() {
  return new Promise(function (resolve, reject) {
    var req = http.request({ hostname: 'localhost', port: 8308, path: '/stream' }, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk.toString()); });
      res.on('end', function () { resolve([chunks, res]); });
    });

    req.on('error', function (e) {
      reject('problem with request:', e.message);
    });

    req.end();
  });
}

function startLocalServer(proxyOptions) {
  var app = express();
  app.get('/stream', proxy('http://localhost:8309', proxyOptions));
  return app.listen(8308);
}

describe('streams / piped requests', function () {
  this.timeout(3000);

  var server;
  var  targetServer;

  beforeEach(function () {
    targetServer = chunkingProxyServer();
  });

  afterEach(function () {
    server.close();
    targetServer.close();
  });

  describe('when streaming options are truthy', function () {
    var TEST_CASES = [{
      name: 'vanilla, no options defined',
      options: {}
    }, {
      name: 'proxyReqOptDecorator is defined',
      options: { proxyReqOptDecorator: function (reqBuilder) { return reqBuilder; } }
    }, {
      //// Keep around this case for manually testing that this for sure fails for a few cycles.   2018 NMK
      //name: 'proxyReqOptDecorator never returns',
      //options: { proxyReqOptDecorator: function () { return new Promise(function () {}); } }
    //}, {

      name: 'proxyReqOptDecorator is a Promise',
      options: { proxyReqOptDecorator: function (reqBuilder) { return Promise.resolve(reqBuilder); } }
    }, {
      name: 'userResHeaderDecorator is defined with a single argument',
      options: {
        userResHeaderDecorator: function (headers) {
          return Object.assign({}, headers, { 'x-my-new-header': 'special-header' });
        }
      },
      expectedHeaders: {
        'x-my-new-header': 'special-header'
      }
    }];

    TEST_CASES.forEach(function (testCase) {
      describe(testCase.name, function () {
        it('chunks are received without any buffering, e.g. before request end', function (done) {
          server = startLocalServer(testCase.options);
          simulateUserRequest()
            .then(function ([chunks, res]) {
              // Assume that if I'm getting a chunked response, it will be an array of length > 1;

              assert(chunks instanceof Array, 'res is an Array');
              assert.equal(chunks.length, 4);

              if (testCase.expectedHeaders) {
                Object.keys(testCase.expectedHeaders).forEach((header) => {
                  assert.equal(res.headers[header], testCase.expectedHeaders[header]);
                });
              }

              done();
            })
            .catch(done);
        });
      });
    });
  });

  describe('when streaming options are falsey', function () {
    var TEST_CASES = [{
      name: 'skipToNextHandler is defined',
      options: { skipToNextHandlerFilter: function () { return false; } }
    }, {
      name: 'userResDecorator is defined',
      options: {
        // eslint-disable-next-line
        userResDecorator: async (proxyRes, proxyResData, _userReq, _userRes) => {
          return proxyResData;
        }
      }
    }, {
      name: 'userResHeaderDecorator is defined',
      options: {
        // eslint-disable-next-line
        userResHeaderDecorator: function (headers, userReq, userRes, proxyReq, proxyRes) {
          return Object.assign({}, headers, { 'x-my-new-header': 'special-header' });
        }
      },
      expectedHeaders: {
        'x-my-new-header': 'special-header'
      }
    }];

    TEST_CASES.forEach(function (testCase) {
      describe(testCase.name, function () {
        it('response arrives in one large chunk', function (done) {
          server = startLocalServer(testCase.options);

          simulateUserRequest()
            .then(function ([chunks, res]) {
              // Assume that if I'm getting a unbuffered response, it will be an array of length = 1;

              assert(chunks instanceof Array);
              assert.equal(chunks.length, 1);

              if (testCase.expectedHeaders) {
                Object.keys(testCase.expectedHeaders).forEach((header) => {
                  assert.equal(res.headers[header], testCase.expectedHeaders[header]);
                });
              }

              done();
            })
            .catch(done);
        });
      });
    });
  });
});
