'use strict';

var url = require('url');

function defaultProxyReqPathResolver(req) {
  return url.parse(req.url).path;
}

function resolveProxyReqPath(container) {
  var resolverFn = container.options.proxyReqPathResolver || defaultProxyReqPathResolver;

  return Promise
    .resolve(resolverFn(container.user.req))
    .then(function(resolvedPath) {
      container.proxy.reqBuilder.path = resolvedPath;
      return Promise.resolve(container);
    });
}

module.exports = resolveProxyReqPath;
