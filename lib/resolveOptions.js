'use strict';

var isUnset = require('../lib/isUnset');
var url = require('url');

function resolveBodyEncoding(reqBodyEncoding) {
    /* For reqBodyEncoding, these is a meaningful difference between null and
    * undefined.  null should be passed forward as the value of reqBodyEncoding,
    * and undefined should result in utf-8.
    */
    return reqBodyEncoding !== undefined ? reqBodyEncoding: 'utf-8';
}

function resolveOptions(options) {
  // resolve user argument to program usable options
  // currenlty, we use a mix of strageies to allow an over-rider;
  options = options || {};

  if (options.decorateRequest) {
    throw new Error(
      'decorateRequest is REMOVED; use decorateReqOpt and decorateReqBody instead.  see README.md'
    );
  }

  if (options.forwardPath || options.forwardPathAsync) {
    console.warn('forwardPath and forwardPathAsync are DEPRECATED and should be replaced with proxyReqPathResolver');
  }

  var  forwardPath = options.forwardPath || defaultForwardPath;


  return {
    proxyReqPathResolver:  options.proxyReqPathResolver || options.forwardPathAsync || options.forwardPath,
    resolveProxyReqPath: options.forwardPathAsync || options.forwardPath || defaultForwardPath,
    filter: options.filter || defaultFilter,
    decorateReqOpt: options.decorateReqOpt || function(reqOpt /*, req */) { return reqOpt; },
    decorateReqBody: options.decorateReqBody || function(bodyContent /*, req*/) { return bodyContent; },
    // For backwards compatability, we default to legacy behavior for newly added settings.
    parseReqBody: isUnset(options.parseReqBody) ? true : options.parseReqBody,
    reqBodyEncoding: resolveBodyEncoding(options.reqBodyEncoding),
    headers: options.headers,
    preserveReqSession: options.preserveReqSession,
    https: options.https,
    port: options.port,
    intercept: options.intercept,
    reqAsBuffer: options.reqAsBuffer,
    memoizeHost: isUnset(options.memoizeHost) ? true: options.memoizeHost,
    timeout: options.timeout
  };
}

function defaultForwardPathAsync(forwardPath) {
  return function(req, res) {
    return new Promise(function(resolve) {
      resolve(forwardPath(req, res));
    });
  };
}

function defaultFilter() {
  // No-op version of filter.  Allows everything!
  return true;
}

function defaultForwardPath(req) {
  return url.parse(req.url).path;
}


module.exports = resolveOptions;
