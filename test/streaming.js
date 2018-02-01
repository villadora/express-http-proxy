var assert = require('assert');
var express = require('express');
var http = require('http');
var startProxyTarget = require('./support/proxyTarget');
var proxy = require('../');

describe('streams', function() {
  'use strict';
  this.timeout(3000);

  var server, targetServer, targetSendChunk, targetEnd;

  beforeEach(function() {
    var app = express();
    app.get('/stream', proxy('http://localhost:8309'));
    server = app.listen(8308);

    var proxyRouteFn = {
      method: 'get',
      path: '/stream',
      fn: function(req, res) {
        res.write('0');
        targetSendChunk = function(data) {
          res.write(data);
        };
        targetEnd = function() {
          res.end();
        };
      }
    };
    targetServer = startProxyTarget(8309, 1000, [proxyRouteFn]);
  });

  afterEach(function() {
    server.close();
    targetServer.close();
  });

  it('chunks are received without any buffering', function(done) {
    var chunks = [];
    var req = http.request({ hostname: 'localhost', port: 8308, path: '/stream' }, function(res) {
      res.on('data', function(chunk) {
        chunks.push(chunk.toString());
      });
      res.once('end', function() {
        assert.deepEqual(chunks, ['0', '1', '2']);
        done();
      });
      targetSendChunk('1');
      targetSendChunk('2');
      targetEnd();
    });
    req.on('error', function(e) {
      console.error('problem with request:', e.message);
    });
    req.end();
  });
});
