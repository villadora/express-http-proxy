'use strict';
var resolveOptions = require('../lib/resolveOptions');

// The original program relied on a multi-nested closure to provide access to all these
// variables in scope.
// In order to separate them (prior to standarding interfaces), I'm making a scope container.
// This may be transitional, and I want to hide the details of this from hooks
function Container(req, res, next, host, userOptions) {
  return {
    user: {
      req: req,
      res: res,
      next: next,
    },
    proxy: {
      req: {},
      res: {},
      bodyContent: {},
      reqBuilder: {},
    },
    options: resolveOptions(userOptions),
    params: {
      host: host,
      userOptions: userOptions
    }
  };
}

module.exports = Container;
