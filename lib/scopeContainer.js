'use strict';
var resolveOptions = require('../lib/resolveOptions');

// Container for scoped arguments in a promise chain.  Each promise recieves
// this as its argument, and returns it.
//
// Do not expose the details of this to hooks/user functions.

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
      resData: undefined,
      bodyContent: undefined,
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
