'use strict';

var as = require('../lib/as');
var resolveProxyReqPath = require('../app/steps/resolveProxyReqPath');
var decorateProxyReqOpt = require('../app/steps/decorateProxyReqOpts');

function getContentLength(body) {

  var result;
  if (Buffer.isBuffer(body)) { // Buffer
    result = body.length;
  } else if (typeof body === 'string') {
    result = Buffer.byteLength(body);
  }
  return result;
}


function decorateRequestWrapper(Container) {
  return new Promise(function(resolve) {
    Promise.all([
      resolveProxyReqPath(Container),
      decorateProxyReqOpt(Container),
      Container.options.decorateReqBody(Container.proxy.bodyContent, Container.user.req)
    ])
    .then(function(values) {
      var path = values[0].proxy.reqBuilder.path;
      var reqOpt = values[1].proxy.reqBuilder;
      var bodyContent = values[2];

      if (typeof reqOpt !== 'object') {
        throw new ReferenceError('decorateProxyReqOpt must return an Object.');
      }

      reqOpt.path = path;

      if (bodyContent) {

        bodyContent = Container.options.reqAsBuffer ?
          as.buffer(bodyContent, Container.options) :
          as.bufferOrString(bodyContent);

        reqOpt.headers['content-length'] = getContentLength(bodyContent);

        if (Container.options.reqBodyEncoding) {
          reqOpt.headers['Accept-Charset'] = Container.options.reqBodyEncoding;
        }
      }

      delete reqOpt.params;

      Container.proxy.reqBuilder = reqOpt;
      Container.proxy.bodyContent = bodyContent;
      // still need to resolve the bodyContent stuff
      resolve(Container);
    });
  });
}

module.exports = decorateRequestWrapper;
