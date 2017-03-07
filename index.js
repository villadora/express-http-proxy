'use strict';

// ROADMAP:
// There are a lot of competing strategies in this code.
// It would be easier to follow if we extract to simpler functions, and used
// a standard, step-wise set of filters with clearer edges and borders.
// Currently working on identifying through comments the workflow steps.

// I think I could extract reqBody and reqOpt to classes

// I think this might be a good pattern to work toward.
// might have to partially apply a lot of arguments up top
//filterRequest(req)
  //.then(createProxyRequestOptions)
  //.then(decorateProxyRequestOptions)
  //.then(decorateProxyRequestBody)
  //.then(makeProxyRequest)
  //.then(decorateProxyResponse)
  //.then(sendUserResponse);
  //.catch(next)

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

  //var parsedHost;

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

    var parseBody = (!parseReqBody) ? Promise.resolve(null) : requestOptions.bodyContent(req, res, options);
    var createReqOptions = requestOptions.create(req, res, options, host);

    var buildProxyReq = Promise.all([
      parseBody,
      createReqOptions
    ]);

    // ProxyRequestPair // { settings, body }
    buildProxyReq.then(function(results) {
      var bodyContent = results[0];
      var reqOpt = results[1];

      if (parseReqBody) {
        reqOpt.bodyContent = bodyContent;
      }

      // need to get resolveProxyPathAsync and decorateRequest off this scope so I can move this
      function decorateRequestWrapper(reqOpt, req) {
        return new Promise(function(resolve) {
          Promise.all([
            // resolve path
            resolveProxyPathAsync(req),
            // resolve decorateRequestHook
            decorateRequest(reqOpt, req)
          ]).then(function(values) {
            var path = values[0];
            var reqOpt = values[1];
            reqOpt.path = path;
            // still need to resolve the bodyContent stuff
            resolve(reqOpt);
          });
        });
      }

      Promise
        // Pattern:   always call the maybe function; have a default noop.
        // Pattern:   use Promise.resolve here to avoid having to guess if its a promise or not.
        .resolve(decorateRequestWrapper(reqOpt, req))
        .then(function(processedReqOpt) {
          if (typeof processedReqOpt !== 'object') {
            throw new ReferenceError('decorateRequest must return an Object.');
          }


          // this can go to an after filter
          // NOTE: at this point, if parseReqBody is false, bodyContent is undefined.  could simplify this logic
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

          // WIP: req, res, and next are not needed until the callback method.
          // split into a thennable
          sendProxyRequest(req, res, next, bodyContent, processedReqOpt)
            .then(function(proxyResponse) {
              var rsp = proxyResponse[0];
              var rspData = proxyResponse[1];

              if (!res.headersSent) {
                res.status(rsp.statusCode);
                Object.keys(rsp.headers)
                  .filter(function(item) { return item !== 'transfer-encoding'; })
                  .forEach(function(item) {
                    res.set(item, rsp.headers[item]);
                  });
              }

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

              // maybe this should actually use a wrapper pattern.
              // if (intercept)
              //   beforeIntercept()
              //   intercept()
              //   afterIntercept();

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


        })
        .catch(next);
    });
  };

  function sendProxyRequest(req, res, next, bodyContent, reqOpt) {
      return new Promise(function(resolve, reject) {
        var protocol = parseHost(host, req, options).module;
        var proxyReq = protocol.request(reqOpt, function(rsp) {
          var chunks = [];
          rsp.on('data', function(chunk) { chunks.push(chunk); });
          rsp.on('end', function()       { resolve([rsp, Buffer.concat(chunks, chunkLength(chunks))]); });
          rsp.on('error', function(err)  { reject(err); });
        });

        proxyReq.on('socket', function(socket) {
          if (options.timeout) {
            socket.setTimeout(options.timeout, function() {
              proxyReq.abort();
            });
          }
        });

        // is this the same as the error I'm checking above as well?
        proxyReq.on('error', function(err) {
          // reject(error);
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

        if (parseReqBody) {
          // We are parsing the body ourselves so we need to write the body content
          // and then manually end the request.
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
