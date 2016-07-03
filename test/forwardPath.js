var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

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
});