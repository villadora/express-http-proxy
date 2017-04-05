'use strict';

function defaultDecorator(proxyReqOptBuilder, userReq) {
  return proxyReqOptBuilder;
}

function decorateProxyReqOpt(container) {
  var resolverFn = container.options.decorateProxyReqOpt || defaultDecorator;
  var safeContainer = Object.assign({}, container);

  return Promise
    .resolve(resolverFn(container.proxy.reqBuilder, container.user.req))
    .then(function(processedReqOpts) {
        safeContainer.proxy.reqBuilder = processedReqOpts;
        return Promise.resolve(safeContainer);
    });
}

module.exports = decorateProxyReqOpt;
