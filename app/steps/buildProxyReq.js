'use strict';

var debug = require('debug')('express-http-proxy');
var requestOptions = require('../../lib/requestOptions');

function buildProxyReq(Container) {
  var req = Container.user.req;
  var res = Container.user.res;
  var options = Container.options;
  var host = Container.proxy.host;

  var parseBody = (!options.parseReqBody) ? Promise.resolve(null) : requestOptions.bodyContent(req, res, options);
  var createReqOptions = requestOptions.create(req, res, options, host);

  return new Promise(function(resolve) {
    Promise
    .all([parseBody, createReqOptions])
    .then(function(responseArray) {
      Container.proxy.bodyContent = responseArray[0];
      Container.proxy.reqBuilder = responseArray[1];
      debug('proxy request options:\n', Container.proxy.reqBuilder);
      resolve(Container);
    });
  });
}

module.exports = buildProxyReq;
