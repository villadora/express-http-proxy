var assert = require('assert');
var express = require('express');
var request = require('supertest');
var proxy = require('../');

describe('http-proxy', function() {
  this.timeout(10000);

  var app;
  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });

  describe('test https', function() {
    it('https', function(done) {
      var https = express();
      https.use(proxy('https://httpbin.org'));
      request(https)
        .get('/user-agent')
        .end(function(err, res) {
          if (err) return done(err);
          assert(res.body['user-agent']);
          done();
        });
    });
    it('https port 443', function(done) {
      var https = express();
      https.use(proxy('httpbin.org:443'));
      request(https)
        .get('/user-agent')
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('test different port', function() {
    it('port', function(done) {
      var http = express();
      var other = express();
      other.get('/', function(req, res) {
        res.send('Hello World!');
      });
      other.listen(8080);
      http.use(proxy('http://localhost', {
        port: 8080
      }));
      request(http)
        .get('/')
        .end(function(err, res) {
          if (err) return done(err);
          assert(res.body);
          done();
        });
    });
  });

  describe('test intercept & decorateRequest', function() {
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


    it('intercept', function(done) {
      var app = express();
      app.use(proxy('httpbin.org', {
        intercept: function(rsp, data, req, res, cb) {
          data = JSON.parse(data.toString('utf8'));
          data.intercepted = true;
          cb(null, JSON.stringify(data));
        }
      }));

      request(app)
        .get('/ip')
        .end(function(err, res) {
          if (err) return done(err);
          assert(res.body.intercepted);
          done();
        });
    });

    it('test intercept original response', function(done) {
      var app = express();
      app.use(proxy('httpbin.org', {
        intercept: function(rsp, data, req, res, cb) {
          assert(rsp.connection);
          assert(rsp.socket);
          assert(rsp.headers);
          assert(rsp.headers['content-type']);
          done();
        }
      }));

      request(app).get('/').end();
    });

    it('test intercept on html response',function(done) {
      var app = express();
      app.use(proxy('httpbin.org', {
        intercept: function(rsp, data, req, res, cb) {
          data = data.toString().replace('Oh','<strong>Hey</strong>');
          assert(data !== "");
          cb(null, data);
        }
      }));

      request(app)
        .get('/html')
        .end(function(err, res) {
          if (err) return done(err);
          assert(res.text.indexOf('<strong>Hey</strong>') > -1);
          done();
        });
    });

    it('test github api', function(done) {
      var app = express();
      app.use(proxy('https://api.github.com',  {
        intercept: function(rsp, data, req, res, cb) {
          var Iconv = require('iconv').Iconv;
          var iconv = new Iconv('UTF-8', 'utf8');
          cb(null, data);
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


  describe('test proxy cookie', function() {
    it('set cookie', function(done) {
      request(app)
        .get('/cookies/set?mycookie=value')
        .end(function(err, res) {
          assert(res.headers['set-cookie']);
          done(err);
        });
    });
  });

  describe('test proxy status', function() {
    [304, 404, 200, 401, 500].forEach(function(status) {
      it(status, function(done) {
        request(app)
          .get('/status/' + status)
          .expect(status, done);
      });
    });
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

  describe('test url parsing', function() {

    it('can parse a url with a port', function(done) {
      var app = express();
      app.use(proxy('http://localhost:9786'));
      request(app)
        .get('/')
        .end(function(err, res) {
          if (err) return done(err);
          assert(true);
          done();
        });
    });

    it('does not throw `Uncaught RangeError` if you have both a port and a trailing slash', function(done) {
      var app = express();
      app.use(proxy('http://localhost:9786/'));
      request(app)
        .get('/')
        .end(function(err, res) {
          if (err) return done(err);
          assert(true);
          done();
        });
    });
  });

});
