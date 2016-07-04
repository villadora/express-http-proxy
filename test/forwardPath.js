var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');
var Promise = require('es6-promise').Promise;

describe('forwardPath', function() {
  'use strict';
  this.timeout(10000);

  it('test post to unknown path yields 404', function(done) {
    var app = express();
    app.use(proxy('httpbin.org'));

    request(app)
      .post('/foobar')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.statusCode, 404);
        done(err);
      });
  });

  it('test forwardPath to known path yields 200', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      forwardPath: function() {
        return '/post';
      }
    }));

    request(app)
      .post('/foobar')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.statusCode, 200);
        done(err);
      });
  });

  it('test forwardPath to undefined yields 404', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      forwardPath: undefined
    }));

    request(app)
      .post('/foobar')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.statusCode, 404);
        done(err);
      });
  });

  it('test forwardPath as an async function should not work', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      forwardPath: function() {
        setTimeout(function () {
          return '/post';        
        }, 100);
      }
    }));

    request(app)
      .post('/foobar')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.statusCode, 405);
        done(err);
      });
  });

  it('test forwardPathAsync to known path yields 200', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      forwardPathAsync: function() {
        return new Promise(function(resolve) {
          setTimeout(function () {
            resolve('/post');        
          }, 250);
        });
      }}
    ));

    request(app)
      .post('/foobar')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.statusCode, 200);
        done(err);
      });
  });
});