'use strict';
var requestOptions = require('../../lib/requestOptions');

function resolveProxyHost(container) {
  var promise;

  if (container.options.memoizeHost && container.options.memoizedHost) {
    promise = Promise.resolve(container.options.memoizedHost);
  } else {
    promise = Promise.resolve(requestOptions.parseHost(container));
  }

  return promise.then(function(parsedHost) {
    container.proxy.reqBuilder.host = parsedHost.host;
    container.proxy.reqBuilder.port = container.options.port || parsedHost.port;
    container.proxy.requestModule = parsedHost.module;
    return container;
  });
}

module.exports = resolveProxyHost;
