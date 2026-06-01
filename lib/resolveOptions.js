'use strict';

var debug = require('debug')('express-http-proxy');

var isUnset = require('../lib/isUnset');

function resolveBodyEncoding(reqBodyEncoding) {

  /* For reqBodyEncoding, these is a meaningful difference between null and
    * undefined.  null should be passed forward as the value of reqBodyEncoding,
    * and undefined should result in utf-8.
    */
  return reqBodyEncoding !== undefined ? reqBodyEncoding : 'utf-8';
}

function resolveStream(options, resolved) {
  // If `stream` is unset, automatically opt into stream mode when no response
  // modifiers are specified.

  var stream;
  if (typeof options.stream === 'boolean') {
    stream = options.stream;
  } else {
    stream = !resolved.skipToNextHandlerFilter &&
             !resolved.userResDecorator &&
             !resolved.userResHeaderDecorator;
  }

  // Streaming is incompatible with these options
  if (stream && resolved.userResDecorator) {
    throw new Error(
      'userResDecorator modifies the response body and requires a buffered ' +
      'response; it cannot be combined with stream:true.'
    );
  }
  if (stream && resolved.skipToNextHandlerFilter) {
    throw new Error(
      'skipToNextHandlerFilter inspects a buffered response and cannot be ' +
      'combined with stream:true.'
    );
  }

  return stream;
}

// parse client arguments

function resolveOptions(options) {
  options = options || {};
  var resolved;

  if (options.decorateRequest) {
    throw new Error(
      'decorateRequest is REMOVED; use proxyReqOptDecorator and' +
      ' proxyReqBodyDecorator instead.  see README.md'
    );
  }

  if (options.forwardPath || options.forwardPathAsync) {
    console.warn(
      'forwardPath and forwardPathAsync are DEPRECATED' +
      ' and should be replaced with proxyReqPathResolver'
    );
  }

  if (options.intercept) {
    console.warn(
      'DEPRECATED: intercept. Use userResDecorator instead.' +
      ' Please see README for more information.'
    );
  }

  resolved = {
    limit: options.limit || '1mb',
    proxyReqPathResolver: options.proxyReqPathResolver
        || options.forwardPathAsync
        || options.forwardPath,
    proxyReqOptDecorator: options.proxyReqOptDecorator,
    proxyReqBodyDecorator: options.proxyReqBodyDecorator,
    userResDecorator: options.userResDecorator || options.intercept,
    userResHeaderDecorator: options.userResHeaderDecorator,
    proxyErrorHandler: options.proxyErrorHandler,
    filter: options.filter,
    // For backwards compatability, we default to legacy behavior for newly added settings.

    parseReqBody: isUnset(options.parseReqBody) ? true : options.parseReqBody,
    preserveHostHdr: options.preserveHostHdr,
    memoizeHost: isUnset(options.memoizeHost) ? true : options.memoizeHost,
    reqBodyEncoding: resolveBodyEncoding(options.reqBodyEncoding),
    skipToNextHandlerFilter: options.skipToNextHandlerFilter,
    headers: options.headers,
    preserveReqSession: options.preserveReqSession,
    https: options.https,
    port: options.port,
    reqAsBuffer: options.reqAsBuffer,
    timeout: options.timeout,
    sendProxyRequest: options.sendProxyRequest
  };

  resolved.stream = resolveStream(options, resolved);

  debug(resolved);
  return resolved;
}

module.exports = resolveOptions;
