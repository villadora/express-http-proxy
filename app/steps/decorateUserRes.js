'use strict';

var as = require('../../lib/as.js');
var debug = require('debug')('express-http-proxy');
var zlib = require('zlib');
var brotli = require('iltorb');

var ENCODING = {
  gzip: 'gzip',
  brotli: 'br'
};

function isResEncoded(res, encoding) {
  return res.headers['content-encoding'] === encoding;
}

const id = data => Promise.resolve(data);

function createGzipHandler(method) {
  return function (data) {
    return new Promise(function (resolve, reject) {
      if (!data || !data.length) {
        return resolve(data);
      }
      zlib[method](data, function (err, buffer) {
        if (err) {
          reject(err);
        } else {
          resolve(buffer);
        }
      });

    });
  };
}

function createEncodingHandler(res) {
  if (isResEncoded(res, ENCODING.gzip)) {
    return {
      decode: createGzipHandler('gunzip'),
      encode: createGzipHandler('gzip')
    };
  } else if (isResEncoded(res, ENCODING.brotli)) {
    return {
      decode: brotli.decompress,
      encode: brotli.compress
    };
  }
  return {
    decode: id,
    encode: id
  };
}

function verifyBuffer(rspd, reject) {
  if (!Buffer.isBuffer(rspd)) {
    return reject(new Error('userResDecorator should return string or buffer as data'));
  }
}

function updateHeaders(res, rspdBefore, rspdAfter, reject) {
  if (!res.headersSent) {
    res.set('content-length', rspdAfter.length);
  } else if (rspdAfter.length !== rspdBefore.length) {
    var error = '"Content-Length" is already sent, ' +
      'the length of response data can not be changed';
    return reject(new Error(error));
  }
}

function decorateProxyResBody(container) {
  var resolverFn = container.options.userResDecorator;

  if (!resolverFn) {
    return Promise.resolve(container);
  }

  var proxyRes = container.proxy.res;
  var req = container.user.req;
  var res = container.user.res;
  var originalResData;

  if (res.statusCode === 304) {
    debug('Skipping userResDecorator on response 304');
    return Promise.resolve(container);
  }

  const encodingHandler = createEncodingHandler(container.proxy.res);

  return encodingHandler.decode(container.proxy.resData)
    .then(function (proxyResData) {
      originalResData = proxyResData;
      return resolverFn(proxyRes, proxyResData, req, res);
    })
    .then(function (modifiedResData) {
      return new Promise(function (resolve, reject) {
        var rspd = as.buffer(modifiedResData, container.options);
        verifyBuffer(rspd, reject);
        updateHeaders(res, originalResData, rspd, reject);
        encodingHandler.encode(rspd).then(function (buffer) {
          container.proxy.resData = buffer;
          resolve(container);
        }).catch(function (error) {
          reject(error);
        });
      });
    });
}

module.exports = decorateProxyResBody;
