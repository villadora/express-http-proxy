'use strict';

// ROADMAP: Major refactoring April 2017
// There are a lot of competing strategies in this code.
// It would be easier to follow if we extract to simpler functions, and used
// a standard, step-wise set of filters with clearer edges and borders.
// Currently working on identifying through comments the workflow steps.

// Phase 1: in progress, nearly complete: Break workflow into composable steps without changing them much
// *: cleanup options interface
// *: extract workflow methods from main file
// *: cleanup workflow methods so they all present as over-rideable thennables
// *: Update/add tests to unit test workflow steps independently
// *: update docs and release

var assert = require('assert');
var ScopeContainer = require('./lib/scopeContainer');
var decorateRequestWrapper = require('./lib/decorateRequestWrapper');
var buildProxyReq = require('./lib/buildProxyReq');
var resolveProxyHost = require('./lib/resolveProxyHost');
var sendProxyRequest = require('./lib/sendProxyRequest');
var decorateUserRes = require('./lib/decorateUserRes');

module.exports = function proxy(host, userOptions) {
  assert(host, 'Host should not be empty');

  return function handleProxy(req, res, next) {
    // TODO: lowercase
    var Container = new ScopeContainer(req, res, next, host, userOptions);

    // Do not proxy request if filter returns false.
    if (!Container.options.filter(req, res)) { return next(); }

    buildProxyReq(Container)
      //.then(determineProtocol)
      .then(resolveProxyHost)
      .then(decorateRequestWrapper) // the wrapper around request decorators.  this could use a better name
      .then(sendProxyRequest)
      //.then(copyProxyResToUserRes)  // add this step by separaing decorateUserRes
      .then(decorateUserRes)
      .then(sendUserRes)
      .catch(next);
  };

};

function sendUserRes(Container) {
    Promise.resolve(Container);
    if (!Container.user.res.headersSent) {
        Container.user.res.send(Container.proxy.resData);
    }
    Promise.resolve(Container);
}


