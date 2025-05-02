'use strict';

var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('response headers', function () {
  describe('when userResHeaderDecorator is defined', function () {

    this.timeout(10000);

    var app;
    var  serverReference;

    afterEach(function () {
      serverReference.close();
    });

    beforeEach(function () {
      app = express();
      var pTarget = express();
      app.use(function (req, res, next) {
        res.cookie('app-set-cookie1', 'app-value1');
        res.cookie('app-set-cookie2', 'app-value2');
        next();
      });
      pTarget.use(function (req, res) {
        res.header('x-my-not-so-secret-header', 'minnie-mouse');
        res.header('x-my-secret-header', 'mighty-mouse');
        res.cookie('pTarget-set-cookie1', 'pTarget-value1');
        res.cookie('pTarget-set-cookie2', 'pTarget-value2');
        res.json(req.headers);
      });
      serverReference = pTarget.listen(12345);
    });

    afterEach(function () {
      serverReference.close();
    });

    it('can delete a header', function (done) {

      app.use('/proxy', proxy('http://127.0.0.1:12345', {
        userResHeaderDecorator: function (headers /*, userReq, userRes, proxyReq, proxyRes */) {
          delete headers['x-my-secret-header'];
          return headers;
        }
      }));

      app.use(function (req, res) {
        res.sendStatus(200);
      });

      request(app)
        .get('/proxy')
        .expect(function (res) {
          assert(Object.keys(res.headers).indexOf('x-my-not-so-secret-header') > -1);
          assert(Object.keys(res.headers).indexOf('x-my-secret-header') === -1);
        })
        .end(done);
    });

    it('provides an interface for updating headers', function (done) {

      app.use('/proxy', proxy('http://127.0.0.1:12345', {
        userResHeaderDecorator: function (headers /*, userReq, userRes, proxyReq, proxyRes */) {
          headers.boltedonheader = 'franky';
          return headers;
        }
      }));

      app.use(function (req, res) {
        res.sendStatus(200);
      });

      request(app)
        .get('/proxy')
        .expect(function (res) {
          assert(res.headers.boltedonheader === 'franky');
        })
        .end(done);
    });

    it('does not overwrite userRes headers', function (done) {

      app.use('/proxy', proxy('http://127.0.0.1:12345', {
        // eslint-disable-next-line no-unused-vars
        userResHeaderDecorator: function (headers, userReq, userRes, proxyReq, proxyRes) {
          headers['set-cookie'] = [...userRes.getHeaders()['set-cookie'], ...proxyRes.headers['set-cookie']];
          return headers;
        }
      }));

      app.use(function (req, res) {
        res.sendStatus(200);
      });

      request(app)
        .get('/proxy')
        .expect(function (res) {
          assert.deepStrictEqual(
            res.headers['set-cookie'],
            [
              'app-set-cookie1=app-value1; Path=/',
              'app-set-cookie2=app-value2; Path=/',
              'pTarget-set-cookie1=pTarget-value1; Path=/',
              'pTarget-set-cookie2=pTarget-value2; Path=/'
            ]
          );
        })
        .end(done);
    });

    it('overwrites res headers when userResHeaderDecorator is not set', function (done) {

      app.use('/proxy', proxy('http://127.0.0.1:12345'));

      app.use(function (req, res) {
        res.sendStatus(200);
      });

      request(app)
        .get('/proxy')
        .expect(function (res) {
          assert.deepStrictEqual(
            res.headers['set-cookie'],
            ['pTarget-set-cookie1=pTarget-value1; Path=/', 'pTarget-set-cookie2=pTarget-value2; Path=/']
          );
        })
        .end(done);
    });
  });
});
