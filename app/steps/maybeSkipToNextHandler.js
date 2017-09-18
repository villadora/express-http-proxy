'use strict';

function defaultSkipFilter(/* res */) {
  return false;
}

function maybeSkipToNextHandler(container) {
  var resolverFn = container.options.skipToNextHandlerFilter || defaultSkipFilter;

  return Promise
    .resolve(resolverFn(container.proxy.res))
    .then(function(shouldSkipToNext) {
      return (shouldSkipToNext) ? Promise.reject() : Promise.resolve(container);
    });
}

module.exports = maybeSkipToNextHandler;
