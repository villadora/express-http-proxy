'use strict';

// ROADMAP: Major refactoring April 2017
// It would be easier to follow if we extract to simpler functions, and used
// a standard, step-wise set of filters with clearer edges and borders.  It
// would be more useful if authors could use Promises for all over-rideable
// steps.

// complete: Break workflow into composable steps without changing them much
// complete: extract workflow methods from main file
// complete: cleanup options interface
// *: cleanup workflow methods so they all present as over-rideable thennables
// *: Update/add tests to unit test workflow steps independently
// *: update docs and release

var ScopeContainer = require('./lib/scopeContainer');
var assert = require('assert');

var buildProxyReq                = require('./app/steps/buildProxyReq');
var copyProxyResHeadersToUserRes = require('./app/steps/copyProxyResHeadersToUserRes');
var decorateProxyReqBody         = require('./app/steps/decorateProxyReqBody');
var decorateProxyReqOpts         = require('./app/steps/decorateProxyReqOpts');
var decorateUserRes              = require('./app/steps/decorateUserRes');
var prepareProxyReq              = require('./app/steps/prepareProxyReq');
var resolveProxyHost             = require('./app/steps/resolveProxyHost');
var resolveProxyReqPath          = require('./app/steps/resolveProxyReqPath');
var sendProxyRequest             = require('./app/steps/sendProxyRequest');
var sendUserRes                  = require('./app/steps/sendUserRes');

module.exports = function proxy(host, userOptions) {
  assert(host, 'Host should not be empty');

  return function handleProxy(req, res, next) {
    var container = new ScopeContainer(req, res, next, host, userOptions);

    // Skip proxy if filter is falsey.  Loose equality so filters can return
    // false, null, undefined, etc.
    if (!container.options.filter(req, res)) { return next(); }

    buildProxyReq(container)
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
