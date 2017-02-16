'use strict';

var assert = require('assert');
var getRawBody = require('raw-body');
var http = require('http');
var https = require('https');
var url = require('url');
var zlib = require('zlib');

var isUnset = require('./lib/isUnset');

// ROADMAP:
// There are a lot of competing strategies in this code.
// It would be easier to follow if we extract to simpler functions, and used
// a standard, step-wise set of filters with clearer edges and borders.
// Currently working on identifying through comments the workflow steps.

module.exports = function proxy(host, options) {
  assert(host, 'Host should not be empty');

  options = options || {};

  var parsedHost;

  /**
   * Function :: intercept(targetResponse, data, res, req, function(err, json, sent));
   */
  var intercept = options.intercept;
  var decorateRequest = options.decorateRequest || function(reqOpt) { return reqOpt; };
  var forwardPath = options.forwardPath || defaultForwardPath;
  var resolveProxyPathAsync = options.forwardPathAsync || defaultForwardPathAsync(forwardPath);
  var filter = options.filter || defaultFilter;
  var limit = options.limit || '1mb';
  var preserveReqSession = options.preserveReqSession;
  var memoizeHost = isUnset(options.memoizeHost) ? true : options.memoizeHost;
  var parseReqBody = isUnset(options.parseReqBody) ? true : options.parseReqBody;

  return function handleProxy(req, res, next) {
    if (!filter(req, res)) { return next(); }
    var resolvePath = resolveProxyPathAsync(req, res);
    var parseBody = (!parseReqBody) ? Promise.resolve(null) : maybeParseBody(req, limit);
    var prepareRequest = Promise.all([resolvePath, parseBody]);
    prepareRequest.then(function(results) {
      var path = results[0];
      var bodyContent = results[1];
      sendProxyRequest(req, res, next, path, bodyContent);
    });
  };

  // TODO: This method is huge and misleading.
  // It prepares the request and sends it and handles it and decorates it and intercepts it.
  // Authors are adding similar code in multiple places.
  // The original appraoch was to use a deeply nested closure, so there is a
  // lot of argument bleed between functional blocks.

  function sendProxyRequest(req, res, next, path, bodyContent) {

    // resolve proxyTo host.  part of preparing proxyRequext
    parsedHost = (memoizeHost && parsedHost) ? parsedHost : parseHost(host, req, options);

    // prepare proxyRequest
    var reqOpt = {
      hostname: parsedHost.host,
      port: options.port || parsedHost.port,
      headers: reqHeaders(req, options),
      method: req.method,
      path: path,
      params: req.params,
    };

    if (parseReqBody) {
      reqOpt.bodyContent = bodyContent;
    }

    if (preserveReqSession) {
      reqOpt.session = req.session;
    }

    // this starts as prepareProxy request, but then fires off the rest of the behavior
    Promise.resolve(decorateRequest(reqOpt, req))
      .then(function(returnedOpt) {

        if (typeof returnedOpt !== 'object') {
          throw new ReferenceError('decorateRequest must return an Object.');
        }

        reqOpt = returnedOpt;
        delete reqOpt.params;

        if (parseReqBody) {
          bodyContent = reqOpt.bodyContent;
          delete reqOpt.bodyContent;

          bodyContent = options.reqAsBuffer ?
            asBuffer(bodyContent, options) :
            asBufferOrString(bodyContent);

          reqOpt.headers['content-length'] = getContentLength(bodyContent);

          if (bodyEncoding(options)) {
            reqOpt.headers['Accept-Charset'] = bodyEncoding(options);
          }
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

            if (!res.headersSent) {
              res.set('content-length', rspd.length);
            } else if (rspd.length !== rspData.length) {
              var error = '"Content-Length" is already sent,' +
                    'the length of response data can not be changed';
              next(new Error(error));
            }

            if (!sent) {
              res.send(rspd);
            }
          };
        }

        var proxyTargetRequest = parsedHost.module.request(reqOpt, function(rsp) {
          var chunks = [];

          rsp.on('data', function(chunk) {
            chunks.push(chunk);
          });

          rsp.on('end', function() {

            var rspData = Buffer.concat(chunks, chunkLength(chunks));

            if (intercept) {
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
      })
      .catch(function(err) {
        next(err);
      });
  }
};



function extend(obj, source, skips) {

  if (!source) {
    return obj;
  }

  for (var prop in source) {
    if (!skips || skips.indexOf(prop) === -1) {
      obj[prop] = source[prop];
    }
  }

  return obj;
}

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

function reqHeaders(req, options) {


  var headers = options.headers || {};

  var skipHdrs = [ 'connection', 'content-length' ];
  if (!options.preserveHostHdr) {
    skipHdrs.push('host');
  }
  var hds = extend(headers, req.headers, skipHdrs);
  hds.connection = 'close';

  return hds;
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

function maybeParseBody(req, limit) {
  var promise;
  if (req.body) {
    promise = new Promise(function(resolve) {
      resolve(req.body);
    });
  } else {
    // Returns a promise if no callback specified and global Promise exists.
    promise = getRawBody(req, {
      length: req.headers['content-length'],
      limit: limit,
    });
  }
  return promise;
}

var maybeUnzipResponse = zipOrUnzip('gunzipSync');
var maybeZipResponse = zipOrUnzip('gzipSync');
