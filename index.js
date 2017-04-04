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
var decorateRequestWrapper = require('./lib/decorateRequestWrapper');
var decorateUserRes = require('./lib/decorateUserRes');
var resolveProxyHost = require('./lib/resolveProxyHost');
var sendProxyRequest = require('./lib/sendProxyRequest');

module.exports = function proxy(host, userOptions) {
  assert(host, 'Host should not be empty');

  return function handleProxy(req, res, next) {
    // TODO: lowercase
    var Container = new ScopeContainer(req, res, next, host, userOptions);

    // Do not proxy request if filter returns false.
    if (!Container.options.filter(req, res)) { return next(); }

    // The Container object is passed down the chain of Promises, with each one
    // of them mutating and returning Container.  The goal is to (eventually)
    // present an interface of swappable promises; IOW, author using this library
    // could replace/override any of these workflow steps
    buildProxyReq(Container)
      .then(resolveProxyHost)
      .then(decorateRequestWrapper) // the wrapper around request decorators.  this could use a better name
      .then(sendProxyRequest)
      .then(decorateUserRes)
      .then(sendUserRes)
      .catch(next);
  };

};
