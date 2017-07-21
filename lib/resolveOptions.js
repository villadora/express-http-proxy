'use strict';

var isUnset = require('../lib/isUnset');

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
      'decorateRequest is REMOVED; use proxyReqOptDecorator and proxyReqBodyDecorator instead.  see README.md'
    );
  }

  if (options.forwardPath || options.forwardPathAsync) {
    console.warn('forwardPath and forwardPathAsync are DEPRECATED and should be replaced with proxyReqPathResolver');
  }

  if (options.intercept) {
    console.warn('DEPRECATED: intercept. Use decorateUseRes instead. Please see README for more information.');
  }

  return {
    limit: options.limit || '1mb',
    proxyReqPathResolver:  options.proxyReqPathResolver || options.forwardPathAsync || options.forwardPath,
    proxyReqOptDecorator: options.proxyReqOptDecorator,
    proxyReqBodyDecorator: options.proxyReqBodyDecorator,
    userResDecorator: options.userResDecorator || options.intercept,
    filter: options.filter || defaultFilter,
    // For backwards compatability, we default to legacy behavior for newly added settings.
    parseReqBody: isUnset(options.parseReqBody) ? true : options.parseReqBody,
    preserveHostHdr: options.preserveHostHdr,
    memoizeHost: isUnset(options.memoizeHost) ? true: options.memoizeHost,
    reqBodyEncoding: resolveBodyEncoding(options.reqBodyEncoding),
    skipToNextHandlerFilter: options.skipToNextHandlerFilter,
    headers: options.headers,
    preserveReqSession: options.preserveReqSession,
    https: options.https,
    port: options.port,
    reqAsBuffer: options.reqAsBuffer,
    timeout: options.timeout
  };
}

function defaultFilter() {
  // No-op version of filter.  Allows everything!
  return true;
}

module.exports = resolveOptions;
