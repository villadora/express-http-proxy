var assert = require('assert');
var express = require('express');
var request = require('supertest');
var fs = require('fs');
var os = require('os');
var proxy = require('../');

describe('body encoding', function() {
  'use strict';
  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });


  it('allow raw data', function(done) {
    var pngHex = '89504e470d0a1a0a0' +
                 '000000d4948445200' +
                 '00000100000001080' +
                 '60000001f15c48900' +
                 '00000a49444154789' +
                 'c6300010000050001' +
                 '0d0a2db4000000004' +
                 '9454e44ae426082';
    var pngData = new Buffer(pngHex, 'hex');
    var filename = os.tmpdir() + '/express-http-proxy-test-' + (new Date()).getTime() + '-png-transparent.png';
    var app = express();
    app.use(proxy('httpbin.org', {
      reqBodyEncoding: null,
      decorateRequest: function(reqOpts) {
        assert((new Buffer(reqOpts.bodyContent).toString('hex')).indexOf(pngData.toString('hex')) >= 0,
          'body should contain same data');
        return reqOpts;
      }
    }));

    fs.writeFile(filename, pngData, function(err) {
      if (err) { throw err; }
      request(app)
        .post('/post')
        .attach('image', filename)
        .end(function(err, res) {
          fs.unlink(filename);
          assert.equal(res.body.files.image, 'data:image/png;base64,' + pngData.toString('base64'));
          done(err);
        });
    });

  });


  describe('when user sets reqBodyEncoding', function() {
    it('should set the accepts-charset header', function(done) {
      var app = express();
      app.use(proxy('httpbin.org', {
        reqBodyEncoding: 'utf-16'
      }));
      request(app)
        .get('/headers')
        .end(function(err, res) {
          if (err) { throw err; }
          assert.equal(res.body.headers['Accept-Charset'], 'utf-16');
          done(err);
        });
    });
  });
});

