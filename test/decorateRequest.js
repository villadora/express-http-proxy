var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

function proxyTarget(port) {
  var other = express();
  other.get('/', function(req, res) {
    res.send('Success');
  });
  return other.listen(port);
}

describe('decorateRequest', function() {
  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });

 it('decorateRequest', function(done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      decorateRequest: function(req) {
        req.path = '/ip';
        req.bodyContent = 'data';
      }
    }));

    request(app)
      .get('/user-agent')
      .end(function(err, res) {
        if (err) return done(err);
        assert(res.body.origin);
        done();
      });
  });


  it('test decorateRequest has access to calling ip', function (done) {
    var app = express();
    app.use(proxy('httpbin.org', {
      decorateRequest: function(reqOpts, req) {
        assert(req.ip);
        return reqOpts;
      }
    }));

    request(app)
      .get('/')
      .end(function(err, res) {
        if (err) return done(err);
        done();
      });

  });
});

