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
    fn: function(req, res) {
      res.write('0');
      setTimeout(function() { res.write('1'); }, 100);
      setTimeout(function() {  res.write('2'); }, 200);
      setTimeout(function() { res.write('3'); }, 300);
      setTimeout(function() { res.end(); }, 500);
    }
  }];

  return startProxyTarget(8309, 1000, proxyRouteFn);
}

function simulateUserRequest() {
  return new Promise(function(resolve, reject) {
    var req = http.request({ hostname: 'localhost', port: 8308, path: '/stream' }, function(res) {
      var chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk.toString()); });
      res.on('end', function() { resolve(chunks); });
    });

    req.on('error', function(e) {
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

describe('streams', function() {
  this.timeout(3000);

  var server, targetServer;

  beforeEach(function() {
    targetServer = chunkingProxyServer();
  });

  afterEach(function() {
    server.close();
    targetServer.close();
  });

  describe('when streaming options are truthy', function() {
    it('chunks are received without any buffering, e.g. before request end', function(done) {

      server = startLocalServer();

      simulateUserRequest()
        .then(function(res) {
          // Assume that if I'm getting a chunked response, it will be an array of length > 1;
          assert(res instanceof Array && res.length === 4);
          done();
        })
        .catch(done);
    });
  });

  describe('when streaming options are falsey', function() {
    it('response arrives in one large chunk', function(done) {
      server = startLocalServer({ skipToNextHandlerFilter: function() { return false; } });

      simulateUserRequest()
        .then(function(res) {
          // Assume that if I'm getting a un-chunked response, it will be an array of length = 1;
          assert(res instanceof Array && res.length === 1);
          done();
        })
        .catch(done);
    });
  });
});
