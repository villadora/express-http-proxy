'use strict';

function defaultSkipFilter(/* proxyRes, userReq, userRes */) {
  return false;
}

function maybeSkipToNextHandler(container) {
  var resolverFn = container.options.skipToNextHandlerFilter || defaultSkipFilter;
  var proxyRes = container.proxy.res;
  var userReq = container.user.req;
  var userRes = container.user.res;

  return Promise
    .resolve(resolverFn(proxyRes, userReq, userRes))
    .then(function (shouldSkipToNext) {
      if (shouldSkipToNext) {
        container.user.res.expressHttpProxy = container.proxy;
        return Promise.reject(container.user.next());
      } else {
        return Promise.resolve(container);
      }
    })
}

module.exports = maybeSkipToNextHandler;
