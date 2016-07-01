var assert = require('assert');
var express = require('express');
var request = require('supertest');
var fs = require('fs');
var os = require('os');
var proxy = require('../');

function proxyTarget(port) {
  var other = express();
  other.get('/', function(req, res) {
    res.send('Success');
  });
  return other.listen(port);
}

describe('http verbs', function() {
  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });

  it('test proxy get', function(done) {
    request(app)
      .get('/get')
      .end(function(err, res) {
        if (err) return done(err);
        assert(/node-superagent/.test(res.body.headers['User-Agent']));
        assert.equal(res.body.url, 'http://httpbin.org/get');
        done(err);
      });
  });

  it('test proxy post', function(done) {
    request(app)
      .post('/post')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.body.data, '{"mypost":"hello"}');
        done(err);
      });
  });

  it('test proxy put', function(done) {
    request(app)
      .put('/put')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.body.data, '{"mypost":"hello"}');
        done(err);
      });
  });

  it('test proxy patch', function(done) {
    request(app)
      .patch('/patch')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.body.data, '{"mypost":"hello"}');
        done(err);
      });
  });

  it('test proxy delete', function(done) {
    request(app)
      .del('/delete')
      .send({
        mypost: 'hello'
      })
      .end(function(err, res) {
        assert.equal(res.body.data, '{"mypost":"hello"}');
        done(err);
      });
  });
});
