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

describe('http-proxy', function() {
  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });

  describe('proxies headers', function () {
    var other, http;
    beforeEach(function () {
      http = express();
      http.use(proxy('https://httpbin.org', {
        'headers': {
            'X-Current-president': 'taft'
        }
      }));
    });

    it('passed as options', function (done) {
      request(http)
       .get('/headers')
       .expect(200)
       .end(function(err, res) {
          if (err) return done(err);
          assert(res.body.headers['X-Current-President'] === 'taft');
          done();
       });
    });

    it('passed as on request', function (done) {
      request(http)
       .get('/headers')
       .set('X-Powerererer', 'XTYORG')
       .expect(200)
       .end(function(err, res) {
          if (err) return done(err);
          assert(res.body.headers['X-Powerererer']);
          done();
       });
    });

  });

  describe('proxies https', function() {

    it('when host is a String and includes \'https\' protocol', function(done) {
      var https = express();
      https.use(proxy('https://httpbin.org'));
      request(https)
        .get('/get?show_env=1')
        .end(function(err, res) {
          if (err) return done(err);
          assert(res.body.headers['X-Forwarded-Ssl'] === 'on');
          assert(res.body.headers['X-Forwarded-Protocol'] === 'https');
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

    it('protocol is resolved correctly if host is function', function (done) {
      var https = express();
      https.use(proxy(function() { return 'https://httpbin.org'; }) );
      request(https)
        .get('/get?show_env=1')
        .end(function(err, res) {
          if (err) return done(err);
          assert(res.body.headers['X-Forwarded-Ssl'] === 'on');
          assert(res.body.headers['X-Forwarded-Protocol'] === 'https');
          done();
        });
    });


    it('https with function for URL', function(done) {
      var https = express();
      https.use(proxy(function() { return 'httpbin.org'; }, {https: true}) );
      request(https)
        .get('/user-agent')
        .end(function(err, res) {
          if (err) return done(err);
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

    it('test intercept on html response', function(done) {
      var app = express();
      app.use(proxy('httpbin.org', {
        intercept: function(rsp, data, req, res, cb) {
          data = data.toString().replace('Oh', '<strong>Hey</strong>');
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

    describe('intercepting a redirect', function () {
      it('allows you to update the location of the redirect', function (done) {

        function redirectingServer(port, origin) {
          var app = express();
          app.get('/', function(req, res) {
            res.status(302);
            res.location(origin + '/proxied/redirect/url');
            res.send();
          });
          return app.listen(port);
        }

        var redirectingServerPort = 8012;
        var redirectingServerOrigin = ['http://localhost', redirectingServerPort].join(':');

        var server = redirectingServer(redirectingServerPort, redirectingServerOrigin);

        var proxyApp = express();
        var preferredPort = 3000;

        proxyApp.use(proxy(redirectingServerOrigin, {
          intercept: function (rsp, data, req, res, cb) {
            var proxyReturnedLocation = res._headers.location;
            res.location(proxyReturnedLocation.replace(redirectingServerPort, preferredPort));
            cb(null, data);
          }
        }));

        request(proxyApp)
          .get('/')
          .expect(function (res) {
            res.headers.location.match(/localhost:3000/);
          })
          .end(function () {
            server.close();
            done();
          });
      });
    });

    it('test github api', function(done) {
      var app = express();
      app.use(proxy('https://api.github.com', {
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

  describe('test proxy middleware compatibility', function() {
    it('should use req.body if defined', function(done) {
      var app = express();

      // Simulate another middleware that puts req stream into the body
      app.use(function(req, res, next) {
        var received = [];
        req.on('data', function onData(chunk) {
          if (!chunk) return;
          received.push(chunk);
        });
        req.on('end', function onEnd(err) {
          received = Buffer.concat(received).toString('utf8');
          req.body = JSON.parse(received);
          req.body.foo = 1;
          next();
        });
      });

      app.use(proxy('example.com', {
        intercept: function(rsp, data, req, res, cb) {
          assert(req.body);
          assert.equal(req.body.foo, 1);
          assert.equal(req.body.mypost, 'hello');
          cb(null, data);
        }
      }));

      request(app)
        .post('/post')
        .send({
          mypost: 'hello'
        })
        .end(function(err, res) {
          done(err);
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

  describe('test http verbs', function() {
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

  describe('test url parsing', function() {
    it('can parse a url with a port', function(done) {
      var app = express();
      app.use(proxy('http://httpbin.org:80'));
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
      app.use(proxy('http://httpbin.org:80/'));
      request(app)
        .get('/')
        .end(function(err, res) {
          if (err) return done(err);
          assert(true);
          done();
        });
    });
  });


  describe('test preserveReqSession', function() {
    it('preserveReqSession', function(done) {
      var app = express();
      app.use(function (req, res, next) {
        req.session = 'hola';
        next();
      });
      app.use(proxy('httpbin.org', {
        preserveReqSession: true,
        decorateRequest: function(req) {
          assert(req.session, 'hola');
        }
      }));

      request(app)
        .get('/user-agent')
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('test body encoding', function() {
    it('allow raw data', function(done) {
      var png_data = new Buffer('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
      var filename = os.tmpdir() + '/express-http-proxy-test-' + Math.floor((Math.random() * 1000) + 1) + '-png-transparent.png';
      var app = express();
      app.use(proxy('httpbin.org', {
        reqBodyEncoding: null,
        decorateRequest: function(reqOpts, req) {
          assert((new Buffer(reqOpts.bodyContent).toString('hex')).indexOf(png_data.toString('hex')) >= 0, 'body should contain same data');
          return reqOpts;
        }
      }));

      fs.writeFile(filename, png_data, function(err) {
        request(app)
          .post('/post')
          .attach('image', filename)
          .end(function(err, res) {
            fs.unlink(filename);
            assert.equal(res.body.files.image, 'data:image/png;base64,' + png_data.toString('base64'));
            done(err);
          });
      });

    });
  });
});

