'use strict';

var chunkLength = require('../../lib/chunkLength');

function sendProxyRequest(Container) {
  var req = Container.user.req;
  var res = Container.user.res;
  var bodyContent = Container.proxy.bodyContent;
  var reqOpt = Container.proxy.reqBuilder;
  var options = Container.options;

  return new Promise(function(resolve, reject) {
    var protocol = Container.proxy.requestModule;
    var proxyReq = protocol.request(reqOpt, function(rsp) {
      var chunks = [];
      rsp.on('data', function(chunk) { chunks.push(chunk); });
      rsp.on('end', function() {
        Container.proxy.res = rsp;
        Container.proxy.resData = Buffer.concat(chunks, chunkLength(chunks));
        resolve(Container);
      });
      rsp.on('error', reject);
    });

    proxyReq.on('socket', function(socket) {
      if (options.timeout) {
        socket.setTimeout(options.timeout, function() {
          proxyReq.abort();
        });
      }
    });

    // TODO: do reject here and handle this later on
    proxyReq.on('error', function(err) {
    // reject(error);
      if (err.code === 'ECONNRESET') {
        res.setHeader('X-Timout-Reason',
          'express-http-proxy timed out your request after ' +
        options.timeout + 'ms.');
        res.writeHead(504, {'Content-Type': 'text/plain'});
        res.end();
      } else {
        reject(err);
      }
    });

    // this guy should go elsewhere, down the chain
    if (options.parseReqBody) {
    // We are parsing the body ourselves so we need to write the body content
    // and then manually end the request.

      //if (bodyContent instanceof Object) {
        //throw new Error
        //debugger;
        //bodyContent = JSON.stringify(bodyContent);
      //}

      if (bodyContent.length) {
        proxyReq.write(bodyContent);
      }
      proxyReq.end();
    } else {
    // Pipe will call end when it has completely read from the request.
      req.pipe(proxyReq);
    }

    req.on('aborted', function() {
    // reject?
      proxyReq.abort();
    });
  });
}


module.exports = sendProxyRequest;
