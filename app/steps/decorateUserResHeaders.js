'use strict';


function decorateUserResHeaders(container) {
  var resolverFn = container.options.userResHeaderDecorator;
  var headersCopy = Object.assign({}, container.user.res._headers);

  if (!resolverFn) {
    return Promise.resolve(container);
  }

  return Promise
    .resolve(resolverFn(headersCopy, container.user.req, container.user.res, container.proxy.req, container.proxy.res))
    .then(function(headers) {
      return new Promise(function(resolve) {
        container.user.res.set(headers);
        resolve(container);
      });
    });
}

module.exports = decorateUserResHeaders;
