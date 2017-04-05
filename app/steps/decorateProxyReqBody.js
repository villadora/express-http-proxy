'use strict';

function defaultDecorator(proxyReqOptBody/*, userReq */) {
  return proxyReqOptBody;
}

function decorateProxyReqBody(container) {
  var resolverFn = container.options.decorateProxyReqBody || defaultDecorator;

  return Promise
    .resolve(resolverFn(container.proxy.bodyContent, container.user.req))
    .then(function(bodyContent) {
      container.proxy.bodyContent = bodyContent;
      return Promise.resolve(container);
    });
}

module.exports = decorateProxyReqBody;
