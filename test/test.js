var assert = require('assert');
var express = require('express'),
    request = require('supertest'),
    proxy = require('../');

describe('bunyan-logger', function() {
    this.timeout(10000);

    var app;
    beforeEach(function() {
        app = express();
        app.use(proxy('httpbin.org'));
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

});