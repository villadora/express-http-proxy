'use strict';
var getHeaders = require('../../lib/getHeaders');

function decorateUserResHeaders(container) {
  var resolverFn = container.options.userResHeaderDecorator;
  var res = container.user.res;
  var rsp = container.proxy.res;

  var headers = getHeaders(container.user.res);

  if (!res.headersSent) {
    res.status(rsp.statusCode);
    Object.keys(rsp.headers)
      .filter(function (item) { return item !== 'transfer-encoding'; })
      .forEach(function (item) {
        headers[item] = rsp.headers[item];
      });
  }

  if (!resolverFn) {
    res.set(headers);
    return Promise.resolve(container);
  }

  const clearAllHeaders = (res) => {
    for (const header in getHeaders(res)) {
      res.removeHeader(header);
    }
  };

  return Promise
    .resolve(resolverFn(headers, container.user.req, container.user.res, container.proxy.req, container.proxy.res))
    .then(function (headers) {
      return new Promise(function (resolve) {
        clearAllHeaders(container.user.res);
        container.user.res.set(headers);
        resolve(container);
      });
    });
}

module.exports = decorateUserResHeaders;
