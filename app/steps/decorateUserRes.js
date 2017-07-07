'use strict';

var as = require('../../lib/as.js');
var debug = require('debug')('express-http-proxy');
var zlib = require('zlib');

function isResGzipped(res) {
  return res.headers['content-encoding'] === 'gzip';
}

function zipOrUnzip(method) {
  return function(rspData, res) {
    return (isResGzipped(res)) ? zlib[method](rspData) : rspData;
  };
}

var maybeUnzipResponse = zipOrUnzip('gunzipSync');
var maybeZipResponse = zipOrUnzip('gzipSync');

function verifyBuffer(rspd, reject) {
  if (!Buffer.isBuffer(rspd)) {
    return reject(new Error('userResDecorator should return string or buffer as data'));
  }
}

function updateHeaders(res, rspdBefore, rspdAfter, reject) {
  if (!res.headersSent) {
      res.set('content-length', rspdAfter.length);
  } else if (rspdAfter.length !== rspdBefore.length) {
      var error = '"Content-Length" is already sent,' +
          'the length of response data can not be changed';
      return reject(new Error(error));
  }
}

function decorateProxyResBody(container) {
  var resolverFn = container.options.userResDecorator;

  if (!resolverFn) {
    return Promise.resolve(container);
  }

  var proxyResData = maybeUnzipResponse(container.proxy.resData, container.proxy.res);
  var proxyRes = container.proxy.res;
  var req = container.user.req;
  var res = container.user.res;

  if (res.statusCode === 304) {
    debug('Skipping userResDecorator on response 304');
    return Promise.resolve(container);
  }

  return Promise
    .resolve(resolverFn(proxyRes, proxyResData, req, res))
    .then(function(modifiedResData) {
      return new Promise(function(resolve, reject) {
        var rspd = as.buffer(modifiedResData, container.options);
        verifyBuffer(rspd, reject);
        updateHeaders(res, proxyResData, rspd, reject);
        container.proxy.resData = maybeZipResponse(rspd, container.proxy.res);
        resolve(container);
      });
    });
}

module.exports = decorateProxyResBody;
