'use strict';

// TODO: Fix these names
var asBuffer = require('../lib/asBuffer').asBuffer;
var asBufferOrString = require('../lib/asBuffer').orString;

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
  return new Promise(function (resolve) {
    Promise.all([
      Container.options.decorateReqPath(Container.user.req),
      Container.options.decorateReqOpt(Container.proxy.reqBuilder, Container.user.req),
      Container.options.decorateReqBody(Container.proxy.bodyContent, Container.user.req)
    ])
    .then(function (values) {
      var path = values[0];
      var reqOpt = values[1];
      var bodyContent = values[2];

      if (typeof reqOpt !== 'object') {
        throw new ReferenceError('decorateReqOpt must return an Object.');
      }

      reqOpt.path = path;

      if (bodyContent) {

        debugger;
        bodyContent = Container.options.reqAsBuffer ?
          asBuffer(bodyContent, Container.options) :
          asBufferOrString(bodyContent);

        debugger;

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
