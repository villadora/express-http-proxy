'use strict';

var express = require('express');
var request = require('supertest');
var proxy = require('../');
var assert = require('assert');

describe('when continueToExpressAtEnd is true', function () {

  this.timeout(10000);

  var app;
  var callBackCalled = false;
  var server;
  var userOptions = { continueToExpressAtEnd: true };

  beforeEach(function () {
    app = express();
    app.use('/proxy', proxy('http://127.0.0.1:12345', userOptions), function () {
      callBackCalled = true;
    });
    server = app.listen(12345);
  });

  afterEach(function () {
    server.close();
  });


  it('Should call the callback function', function (done) {
    request(app)
      .get('/proxy')
      .expect(200)
      .end(function () {
        assert(callBackCalled);
        done();
      });


  });

});

describe('when continueToExpressAtEnd is not defnined (default behavior)', function () {

  this.timeout(10000);

  var app;
  var callBackCalled = false;
  var server;

  beforeEach(function () {
    app = express();
    app.use('/proxy', proxy('http://127.0.0.1:12345'), function () {callBackCalled = true;});
    server = app.listen(12345);
  });

  afterEach(function () {
    server.close();
  });


  it('Should call the callback function', function (done) {
    request(app)
      .get('/proxy')
      .expect(200)
      .end(function () {
        assert(!callBackCalled);
        done();
      });

  });

});
