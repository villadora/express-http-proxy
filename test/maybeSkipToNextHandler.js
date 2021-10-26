'use strict';

var express = require('express');
var request = require('supertest');
var proxy = require('../');
var http = require('http');
var assert = require('assert');

describe('when skipToNextHandlerFilter is defined', function () {

  this.timeout(10000);

  var app;
  var  slowTarget;
  var  serverReference;

  beforeEach(function () {
    app = express();
    slowTarget = express();
    slowTarget.use(function (req, res) { res.sendStatus(404); });
    serverReference = slowTarget.listen(12345);
  });

  afterEach(function () {
    serverReference.close();
  });

  var OUTCOMES = [
    { shouldSkip: true, expectedStatus: 200 },
    { shouldSkip: false, expectedStatus: 404 },
    { shouldSkip: true, expectedStatus: 200, delayedSkipProxyDecision: true },
    { shouldSkip: false, expectedStatus: 404, delayedSkipProxyDecision: false }
  ];

  OUTCOMES.forEach(function (outcome) {
    describe('and returns ' + outcome.shouldSkip, function () {
      it('express-http-proxy' + (outcome.shouldSkip ? ' skips ' : ' doesnt skip ') + 'to next()', function (done) {

        if (outcome.delayedSkipProxyDecision !== undefined) {
          app.use(function (req, res, next) {
            res.locals.skipProxyDecisionPromise = new Promise(function (resolve) {
              setTimeout(function () {
                resolve(outcome.delayedSkipProxyDecision);
              }, 50);
            });
            next();
          });
        }

        app.use('/proxy', proxy('http://127.0.0.1:12345', {
          skipToNextHandlerFilter: function (proxyRes, userReq, userRes) {
            return userRes.locals.skipProxyDecisionPromise || outcome.shouldSkip;
          }
        }));

        app.use(function (req, res) {
          assert(res.expressHttpProxy instanceof Object);
          assert(res.expressHttpProxy.res instanceof http.IncomingMessage);
          assert(res.expressHttpProxy.req instanceof Object);
          res.sendStatus(200);
        });

        request(app)
          .get('/proxy')
          .expect(outcome.expectedStatus)
          .end(done);
      });
    });
  });
});
