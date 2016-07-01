var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('middleware compatibility', function() {
  'use strict';
  it('should use req.body if defined', function(done) {
    var app = express();

    // Simulate another middleware that puts req stream into the body
    app.use(function(req, res, next) {
      var received = [];
      req.on('data', function onData(chunk) {
        if (!chunk) { return; }
        received.push(chunk);
      });
      req.on('end', function onEnd() {
        received = Buffer.concat(received).toString('utf8');
        req.body = JSON.parse(received);
        req.body.foo = 1;
        next();
      });
    });

    app.use(proxy('example.com', {
      intercept: function(rsp, data, req, res, cb) {
        assert(req.body);
        assert.equal(req.body.foo, 1);
        assert.equal(req.body.mypost, 'hello');
        cb(null, data);
      }
    }));

    request(app)
      .post('/post')
      .send({
        mypost: 'hello'
      })
      .end(function(err) {
        done(err);
      });
  });
});
