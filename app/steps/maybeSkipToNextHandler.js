'use strict';

function defaultSkipFilter(/* res */) {
  return false;
}

function maybeSkipToNextHandler(container) {
  var resolverFn = container.options.skipToNextHandlerFilter || defaultSkipFilter;

  return Promise
    .resolve(resolverFn(container.proxy.res))
    .then(function(shouldSkipToNext) {
      return (shouldSkipToNext) ? container.user.next() : Promise.resolve(container);
    })
    .catch(Promise.reject);
}

module.exports = maybeSkipToNextHandler;
