'use strict';

function defaultDecorator(proxyReqOptBuilder, userReq) {
  return proxyReqOptBuilder;
}

function decorateProxyReqOpt(container) {
  var resolverFn = container.options.decorateProxyReqOpt || defaultDecorator;

  return Promise
    .resolve(resolverFn(container.proxy.reqBuilder, container.user.req))
    .then(function(processedReqOpts) {
        container.proxy.reqBuilder = processedReqOpts;
        return Promise.resolve(container);
    });
}

module.exports = decorateProxyReqOpt;
