'use strict';

// The original program relied on a multi-nested closure to provide access to all these
// variables in scope.
// In order to separate them (prior to standarding interfaces), I'm making a scope container.
// This may be transitional, and I want to hide the details of this from hooks
var Container = {
  user: {
    req: {},
    res: {},
    next: null,
  },
  proxy: {
    req: {},
    res: {},
    bodyContent: {},
    reqBuilder: {}
  },
  options: {}
};

module.exports = Container;
