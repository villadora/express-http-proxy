'use strict';

// ROADMAP: Major refactoring April 2017
// There are a lot of competing strategies in this code.
// It would be easier to follow if we extract to simpler functions, and used
// a standard, step-wise set of filters with clearer edges and borders.

// complete: Break workflow into composable steps without changing them much
// complete: extract workflow methods from main file
// started: cleanup options interface
// *: cleanup workflow methods so they all present as over-rideable thennables
// *: Update/add tests to unit test workflow steps independently
// *: update docs and release

var ScopeContainer = require('./lib/scopeContainer');
var assert = require('assert');
var buildProxyReq = require('./lib/buildProxyReq');
var decorateUserRes = require('./app/steps/decorateUserRes');
var resolveProxyHost = require('./lib/resolveProxyHost');
var sendProxyRequest = require('./lib/sendProxyRequest');
var sendUserRes = require('./lib/sendUserRes');
var resolveProxyReqPath = require('./app/steps/resolveProxyReqPath');
var decorateProxyReqOpts = require('./app/steps/decorateProxyReqOpts');
var decorateProxyReqBody = require('./app/steps/decorateProxyReqBody');
var prepareProxyReq = require('./app/steps/prepareProxyReq');
var copyProxyResHeadersToUserRes = require('./app/steps/copyProxyResHeadersToUserRes');

module.exports = function proxy(host, userOptions) {
  assert(host, 'Host should not be empty');

  return function handleProxy(req, res, next) {
    // TODO: lowercase
    var Container = new ScopeContainer(req, res, next, host, userOptions);

    // Skip proxy if filter is falsey.  Loose equality so filters can return
    // false, null, undefined, etc.
    if (!Container.options.filter(req, res)) { return next(); }

    // The Container object is passed down the chain of Promises, with each one
    // of them mutating and returning Container.  The goal is that (eventually)
    // author using this library // could hook into/override any of these
    // workflow steps with a Promise or simple function.
    buildProxyReq(Container)
      .then(resolveProxyHost)
      .then(decorateProxyReqOpts)
      .then(resolveProxyReqPath)
      .then(decorateProxyReqBody)
      .then(prepareProxyReq)
      .then(sendProxyRequest)
      .then(copyProxyResHeadersToUserRes)
      .then(decorateUserRes)
      .then(sendUserRes)
      .catch(next);
  };
};
