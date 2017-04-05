'use strict';

function defaultDecorator(proxyReqOptBuilder, userReq) {
  debugger;
  return proxyReqOptBuilder;
}

function decorateProxyReqOpt(container) {
  var resolverFn = container.options.decorateProxyReqOpt || defaultDecorator;

  debugger;
  return Promise
    .resolve(resolverFn(container.proxy.reqBuilder, container.user.req))
    .then(function(processedReqOpts) {
        debugger;
        container.proxy.reqBuilder = processedReqOpts;
        return Promise.resolve(container);
    });
}

module.exports = decorateProxyReqOpt;
