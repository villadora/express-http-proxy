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
  options = options || {};

  if (options.decorateRequest) {
    throw new Error(
      'decorateRequest is REMOVED; use decorateProxyReqOpt and decorateProxyReqBody instead.  see README.md'
    );
  }

  if (options.forwardPath || options.forwardPathAsync) {
    console.warn('forwardPath and forwardPathAsync are DEPRECATED and should be replaced with proxyReqPathResolver');
  }

  if (options.intercept) {
    console.warn('DEPRECATED: intercept. Use decorateUseRes instead. Please see README for more information.');
  }

  return {
    proxyReqPathResolver:  options.proxyReqPathResolver || options.forwardPathAsync || options.forwardPath,
    resolveProxyReqPath: options.forwardPathAsync || options.forwardPath || defaultForwardPath,
    filter: options.filter || defaultFilter,
    decorateProxyReqOpt: options.decorateProxyReqOpt,
    decorateProxyReqBody: options.decorateProxyReqBody,
    // For backwards compatability, we default to legacy behavior for newly added settings.
    parseReqBody: isUnset(options.parseReqBody) ? true : options.parseReqBody,
    memoizeHost: isUnset(options.memoizeHost) ? true: options.memoizeHost,
    reqBodyEncoding: resolveBodyEncoding(options.reqBodyEncoding),
    headers: options.headers,
    preserveReqSession: options.preserveReqSession,
    https: options.https,
    port: options.port,
    decorateUserRes: options.decorateUserRes || options.intercept,
    reqAsBuffer: options.reqAsBuffer,
    timeout: options.timeout
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
