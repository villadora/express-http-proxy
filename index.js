'use strict';

// ROADMAP:
// There are a lot of competing strategies in this code.
// It would be easier to follow if we extract to simpler functions, and used
// a standard, step-wise set of filters with clearer edges and borders.
// Currently working on identifying through comments the workflow steps.
// I think I could extract reqBody and reqOpt to classes
// I think this might be a good pattern to work toward.

// filterRequest(req)
// .then(createProxyRequestOptions)
// .then(decorateProxyRequestOptions)
// .then(decorateProxyRequestBody)
// .then(makeProxyRequest)
// .then(decorateProxyResponse)
// .then(sendUserResponse);
// .catch(next)

var assert = require('assert');
var http = require('http');
var https = require('https');
var url = require('url');
var zlib = require('zlib');
var requestOptions = require('./lib/requestOptions');

var isUnset = require('./lib/isUnset');

module.exports = function proxy(host, options) {
  assert(host, 'Host should not be empty');

  options = options || {};

  /**
   * Function :: intercept(targetResponse, data, res, req, function(err, json, sent));
   */
  var intercept = options.intercept;
  var decorateRequest = options.decorateRequest || function(reqOpt) { return reqOpt; };
  var forwardPath = options.forwardPath || defaultForwardPath;
  var resolveProxyPathAsync = options.forwardPathAsync || defaultForwardPathAsync(forwardPath);
  var filter = options.filter || defaultFilter;

  // For backwards compatability, we default to legacy behavior for newly added settings.
  var parseReqBody = isUnset(options.parseReqBody) ? true : options.parseReqBody;

  return function handleProxy(req, res, next) {
    // Do not proxy request if filter returns false.
    if (!filter(req, res)) { return next(); }

    // maybe? new ProxyRequestBuilder(req, res, options, host)
    // maybe? ProxyRequestBuilder.create(req, res, options, host)
    // requestOptions.create(req, res, options, host)
    // reqOpt.bodyContent = bodyContent;
    // .then(function(reqOpts) {
    // decorateProxyRequestOptions
    // });

    var resolvePath = resolveProxyPathAsync(req, res);
    var parseBody = (!parseReqBody) ? Promise.resolve() : requestOptions.bodyContent(req, res, options);
    var createReqOptions = requestOptions.create(req, res, options, host);

    var prepareRequest = Promise.all([
      resolvePath, // this is in a weird place.  I'ts a part of decorateRequestOpts
      parseBody,
      createReqOptions
    ]);


    prepareRequest.then(function(results) {
      var path = results[0];
      var bodyContent = results[1];
      var reqOpt = results[2];

      if (parseReqBody) {
        reqOpt.bodyContent = bodyContent;
      }

      // this should move to decorateRequestOptions
      reqOpt.path = path;

      Promise
        .resolve(decorateRequest(reqOpt, req))
        .then(function(processedReqOpt) {
          if (typeof processedReqOpt !== 'object') {
            throw new ReferenceError('decorateRequest must return an Object.');
          }

          // this can go to an after filter
          if (parseReqBody) {
            bodyContent = options.reqAsBuffer ?
              asBuffer(bodyContent, options) :
              asBufferOrString(bodyContent);

            reqOpt.headers['content-length'] = getContentLength(bodyContent);

            if (bodyEncoding(options)) {
              reqOpt.headers['Accept-Charset'] = bodyEncoding(options);
            }
          }

          delete processedReqOpt.params;

          sendProxyRequest(req, res, next, path, bodyContent, processedReqOpt);
        })
        .catch(next);
    });
  };

  // TODO: This method is huge and misleading.
  // It prepares the request and sends it and handles it and decorates it and intercepts it.
  // Authors are adding similar code in multiple places.
  // The original appraoch was to use a deeply nested closure, so there is a
  // lot of argument bleed between functional blocks.

  function sendProxyRequest(req, res, next, path, bodyContent, reqOpt) {

    // Extract: define method in closure so I have access to necessary variables.
    // extract by making this return a value, rather than mutate a value
    // maybe this should actually use a wrapper pattern.
    // if (intercept)
    //   beforeIntercept()
    //   intercept()
    //   afterIntercept();

    function postIntercept(res, next, rspData) {
      return function(err, rspd, sent) {
        if (err) {
          return next(err);
        }
        rspd = asBuffer(rspd, options);
        rspd = maybeZipResponse(rspd, res);

        if (!Buffer.isBuffer(rspd)) {
          next(new Error('intercept should return string or' +
                'buffer as data'));
        }

        // TODO: return rspd here

        // afterIntercept
        if (!res.headersSent) {
          res.set('content-length', rspd.length);
        } else if (rspd.length !== rspData.length) {
          var error = '"Content-Length" is already sent,' +
                'the length of response data can not be changed';
          next(new Error(error));
        }

        //  returns res to user
        if (!sent) {
          res.send(rspd);
        }
      };
    }

    //  actually making the request, callback form
    var protocol = parseHost(host, req, options).module;
    var proxyTargetRequest = protocol.request(reqOpt, function(rsp) {
      var chunks = [];

      rsp.on('data', function(chunk) {
        chunks.push(chunk);
      });

      rsp.on('end', function() {

        var rspData = Buffer.concat(chunks, chunkLength(chunks));

        if (intercept) {
          // beforeIntercept
          rspData = maybeUnzipResponse(rspData, res);
          var callback = postIntercept(res, next, rspData);
          intercept(rsp, rspData, req, res, callback);
        } else {
          // see issue https://github.com/villadora/express-http-proxy/issues/104
          // Not sure how to automate tests on this line, so be careful when changing.
          if (!res.headersSent) {
            res.send(rspData);
          }
        }
      });

      rsp.on('error', function(err) {
        next(err);
      });

      // copy proxy res values to use res
      if (!res.headersSent) {
        res.status(rsp.statusCode);
        Object.keys(rsp.headers)
          .filter(function(item) { return item !== 'transfer-encoding'; })
          .forEach(function(item) {
            res.set(item, rsp.headers[item]);
          });
      }
    });

    proxyTargetRequest.on('socket', function(socket) {
      if (options.timeout) {
        socket.setTimeout(options.timeout, function() {
          proxyTargetRequest.abort();
        });
      }
    });

    proxyTargetRequest.on('error', function(err) {
      if (err.code === 'ECONNRESET') {
        res.setHeader('X-Timout-Reason',
          'express-http-proxy timed out your request after ' +
          options.timeout + 'ms.');
        res.writeHead(504, {'Content-Type': 'text/plain'});
        res.end();
      } else {
        next(err);
      }
    });

    // prepare proxy request
    if (parseReqBody) {
      // We are parsing the body ourselves so we need to write the body content
      // and then manually end the request.
      if (bodyContent.length) {
        proxyTargetRequest.write(bodyContent);
      }
      proxyTargetRequest.end();
    } else {
      // Pipe will call end when it has completely read from the request.
      req.pipe(proxyTargetRequest);
    }


    req.on('aborted', function() {
      proxyTargetRequest.abort();
    });
  }
};



// Utility methods from here on down.
function parseHost(host, req, options) {

  host = (typeof host === 'function') ? host(req) : host.toString();

  if (!host) {
    return new Error('Empty host parameter');
  }

  if (!/http(s)?:\/\//.test(host)) {
    host = 'http://' + host;
  }

  var parsed = url.parse(host);

  if (!parsed.hostname) {
    return new Error('Unable to parse hostname, possibly missing protocol://?');
  }

  var ishttps = options.https || parsed.protocol === 'https:';

  return {
    host: parsed.hostname,
    port: parsed.port || (ishttps ? 443 : 80),
    module: ishttps ? https : http,
  };
}

function defaultFilter() {
  // No-op version of filter.  Allows everything!

  return true;
}

function defaultForwardPath(req) {

  return url.parse(req.url).path;
}

function bodyEncoding(options) {


  /* For reqBodyEncoding, these is a meaningful difference between null and
   * undefined.  null should be passed forward as the value of reqBodyEncoding,
   * and undefined should result in utf-8.
   */

  return options.reqBodyEncoding !== undefined ? options.reqBodyEncoding: 'utf-8';
}


function chunkLength(chunks) {


  return chunks.reduce(function(len, buf) {
    return len + buf.length;
  }, 0);
}

function defaultForwardPathAsync(forwardPath) {

  return function(req, res) {
    return new Promise(function(resolve) {
      resolve(forwardPath(req, res));
    });
  };
}

function asBuffer(body, options) {

  var ret;
  if (Buffer.isBuffer(body)) {
    ret = body;
  } else if (typeof body === 'object') {
    ret = new Buffer(JSON.stringify(body), bodyEncoding(options));
  } else if (typeof body === 'string') {
    ret = new Buffer(body, bodyEncoding(options));
  }
  return ret;
}

function asBufferOrString(body) {

  var ret;
  if (Buffer.isBuffer(body)) {
    ret = body;
  } else if (typeof body === 'object') {
    ret = JSON.stringify(body);
  } else if (typeof body === 'string') {
    ret = body;
  }
  return ret;
}

function getContentLength(body) {

  var result;
  if (Buffer.isBuffer(body)) { // Buffer
    result = body.length;
  } else if (typeof body === 'string') {
    result = Buffer.byteLength(body);
  }
  return result;
}

function isResGzipped(res) {
  return res._headers['content-encoding'] === 'gzip';
}

function zipOrUnzip(method) {
  return function(rspData, res) {
    return (isResGzipped(res)) ? zlib[method](rspData) : rspData;
  };
}

var maybeUnzipResponse = zipOrUnzip('gunzipSync');
var maybeZipResponse = zipOrUnzip('gzipSync');
