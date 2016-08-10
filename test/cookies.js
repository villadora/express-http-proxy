var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('proxies cookie', function() {
  'use strict';

  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });

  it('set cookie', function(done) {
    request(app)
      .get('/cookies/set?mycookie=value')
      .end(function(err, res) {
        assert(res.headers['set-cookie']);
        done(err);
      });
  });
});
