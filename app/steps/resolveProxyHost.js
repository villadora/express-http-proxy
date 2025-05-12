'use strict';
var requestOptions = require('../../lib/requestOptions');

function resolveProxyHost(container) {
  return Promise.resolve(container.options.memoizeHost && container.options.memoizedHost ? 
    container.options.memoizedHost : 
    requestOptions.parseHost(container)).then(parsedHost => {
      container.proxy.reqBuilder.host = parsedHost.host;
      container.proxy.reqBuilder.port = container.options.port || parsedHost.port;
      container.proxy.requestModule = parsedHost.module;
      return Promise.resolve(container);
    });
}

module.exports = resolveProxyHost;
