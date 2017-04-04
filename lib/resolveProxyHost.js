'use strict';
var requestOptions = require('../lib/requestOptions');

function resolveProxyHost(Container) {
  var parsedHost;

  if (Container.options.memoizeHost && Container.options.memoizedHost) {
    parsedHost = Container.options.memoizedHost;
  } else {
    parsedHost = requestOptions.parseHost(Container);
  }

  Container.proxy.reqBuilder.host = parsedHost.host;
  Container.proxy.reqBuilder.port = Container.options.port || parsedHost.port;
  Container.proxy.requestModule = parsedHost.module;
  return Promise.resolve(Container);
}

module.exports = resolveProxyHost;
