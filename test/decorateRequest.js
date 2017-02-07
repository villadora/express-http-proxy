var assert = require('assert');
var express = require('express');
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

    describe('when decorateRequest is a simple function (non Promise)', function() {
      it('should mutate the proxied request', function(done) {
        var app = express();
        app.use(proxy('httpbin.org', {
          decorateRequest: function(reqOpt, req) {
            reqOpt.headers['user-agent'] = 'test user agent';
            assert(req);
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

    describe('when decorate request is a Promise', function() {
      it('should mutate the proxied request', function(done) {
        var app = express();
        app.use(proxy('httpbin.org', {
          decorateRequest: function(reqOpt, req) {
            assert(req);
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

  describe('decorateRequest has access to the source request\'s data', function() {
    it('should have access to ip', function(done) {
      var app = express();
      app.use(proxy('httpbin.org', {
        decorateRequest: function(reqOpts, req) {
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
