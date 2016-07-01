var assert = require('assert');
var express = require('express');
var request = require('supertest');
var fs = require('fs');
var os = require('os');
var proxy = require('../');

describe('body encoding', function() {
  this.timeout(10000);

  var app;

  beforeEach(function() {
    app = express();
    app.use(proxy('httpbin.org'));
  });


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

