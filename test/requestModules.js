'use strict';

var assert = require('assert');
var express = require('express');
var request = require('supertest');
var http = require('http');
var https = require('https');
var proxy = require('..');

/*
 * Make a custom http request module that throws an immediate error.
 * This should show up as a 500 response with the error embedded as text.
 */
var customModule = {
  request: function () {
    throw new Error('Successfully called custom module.');
  }
};

describe('requestModules', function () {

  this.timeout(10000);

  it('can override http with a custom module', function (done) {
    var app = express();
    app.use(proxy('http://httpbin.org:80', {
      requestModules: {
        http: customModule,
        https: https
      }
    }));
    request(app)
      .get('/')
      .end(function (err, res) {
        assert(res);
        assert(res.statusCode === 500);
        assert(res.text.indexOf('Successfully called custom module.') > -1);
        done();
      });
  });

  it('can override https with a custom module', function (done) {
    var app = express();
    app.use(proxy('https://httpbin.org:443', {
      requestModules: {
        http: http,
        https: customModule
      }
    }));
    request(app)
      .get('/')
      .end(function (err, res) {
        assert(res);
        assert(res.statusCode === 500);
        assert(res.text.indexOf('Successfully called custom module.') > -1);
        done();
      });
  });

  it('throws error if neither protocol is defined', function (done) {
    var app = express();
    app.use(proxy('http://httpbin.org:80', {
      requestModules: {}
    }));
    request(app)
      .get('/')
      .end(function (err, res) {
        assert(res);
        assert(res.statusCode === 500);
        assert(res.text.indexOf('requestModules') > -1);
        done();
      });
  });
});
