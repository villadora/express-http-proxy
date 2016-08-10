var assert = require('assert');
var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
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

    app.use(proxy('httpbin.org', {
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
      .expect(function(res) {
        assert.equal(res.body.json.foo, 1);
        assert.equal(res.body.json.mypost, 'hello');
      })
      .end(done);
  });

  it('should stringify req.body when it is a json body so it is written to proxy request', function(done) {
    var app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
      extended: false
    }));
    app.use(proxy('httpbin.org'));
    request(app)
      .post('/post')
      .send({
        mypost: 'hello',
        doorknob: 'wrect'
      })
      .expect(function(res) {
        assert.equal(res.body.json.doorknob, 'wrect');
        assert.equal(res.body.json.mypost, 'hello');
      })
      .end(done);
  });

  it('should convert req.body to a Buffer when reqAsBuffer is set', function(done) {
    var app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
      extended: false
    }));
    app.use(proxy('httpbin.org', {
      reqAsBuffer: true
    }));
    request(app)
      .post('/post')
      .send({
        mypost: 'hello',
        doorknob: 'wrect'
      })
      .expect(function(res) {
        assert.equal(res.body.json.doorknob, 'wrect');
        assert.equal(res.body.json.mypost, 'hello');
      })
      .end(done);
  });

});
