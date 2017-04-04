var assert = require('assert');
var express = require('express');
var http = require('http');
var request = require('supertest');
var proxy = require('../');

describe('decorateRequest', function() {
  'use strict';

  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });

  describe('Supports Promise and non-Promise forms', function() {

    describe('when decorateReqOpts is a simple function (non Promise)', function() {
      it('should mutate the proxied request', function(done) {
        var app = express();
        app.use(proxy('httpbin.org', {
          decorateReqOpt: function(reqOpt, req) {
            reqOpt.headers['user-agent'] = 'test user agent';
            assert(req instanceof http.IncomingMessage);
            return reqOpt;
          }
        }));

        request(app)
        .get('/user-agent')
        .end(function(err, res) {
          if (err) { return done(err); }
          assert.equal(res.body['user-agent'], 'test user agent');
          done();
        });
      });
    });

    describe('when decorateReqOpt is a Promise', function() {
      it('should mutate the proxied request', function(done) {
        var app = express();
        app.use(proxy('httpbin.org', {
          decorateReqOpt: function(reqOpt, req) {
            assert(req instanceof http.IncomingMessage);
            return new Promise(function(resolve) {
              reqOpt.headers['user-agent'] = 'test user agent';
              resolve(reqOpt);
            });
          }
        }));

        request(app)
        .get('/user-agent')
        .end(function(err, res) {
          if (err) { return done(err); }
          assert.equal(res.body['user-agent'], 'test user agent');
          done();
        });
      });
    });
  });

  describe('decorateReqOpt has access to the source request\'s data', function() {
    it('should have access to ip', function(done) {
      var app = express();
      app.use(proxy('httpbin.org', {
        decorateReqOpt: function(reqOpts, req) {
          assert(req instanceof http.IncomingMessage);
          assert(req.ip);
          return reqOpts;
        }
      }));

      request(app)
      .get('/')
      .end(function(err) {
        if (err) { return done(err); }
        done();
      });

    });
  });
});
