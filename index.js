'use strict';

// ROADMAP: Major refactoring April 2017
// There are a lot of competing strategies in this code.
// It would be easier to follow if we extract to simpler functions, and used
// a standard, step-wise set of filters with clearer edges and borders.
// Currently working on identifying through comments the workflow steps.

// Phase 1: in progress, nearly complete: Break workflow into composable steps without changing them much
// *: cleanup options interface
// *: extract workflow methods from main file
// *: cleanup workflow methods so they all present as over-rideable thennables
// *: Update/add tests to unit test workflow steps independently
// *: update docs and release

var assert = require('assert');
var http = require('http');
var https = require('https');
var url = require('url');
var zlib = require('zlib');
var requestOptions = require('./lib/requestOptions');
var isUnset = require('./lib/isUnset');
var chunkLength = require('./lib/chunkLength');
var Container = require('./lib/scopeContainer');



function resolveOptions(options) {
  // resolve user argument to program usable options
  // currenlty, we use a mix of strageies to allow an over-rider;
  options = options || {};

  if (options.decorateRequest) {
    throw new Error(
      'decorateRequest is REMOVED; use decorateReqOpt and decorateReqBody instead.  see README.md'
    );
  }

  var  forwardPath = options.forwardPath || defaultForwardPath;

  return {
    decorateReqPath: options.forwardPathAsync || defaultForwardPathAsync(forwardPath),
    filter: options.filter || defaultFilter,
    decorateReqOpt: options.decorateReqOpt || function(reqOpt /*, req */) { return reqOpt; },
    decorateReqBody: options.decorateReqBody || function(bodyContent /*, req*/) { return bodyContent; },
    // For backwards compatability, we default to legacy behavior for newly added settings.
    parseReqBody: isUnset(options.parseReqBody) ? true : options.parseReqBody,
    reqBodyEncoding: options.reqBodyEncoding,
    headers: options.headers,
    preserveReqSession: options.preserveReqSession,
    https: options.https,
    port: options.port,
    intercept: options.intercept
  };
}

module.exports = function proxy(host, userOptions) {
  assert(host, 'Host should not be empty');
  // TODO: lowercase
  Container.options = resolveOptions(userOptions);

  function decorateRequestWrapper(Container) {

    return new Promise(function(resolve) {
      Promise.all([
          Container.options.decorateReqPath(Container.user.req),
          Container.options.decorateReqOpt(Container.proxy.reqBuilder, Container.user.req),
          Container.options.decorateReqBody(Container.proxy.bodyContent, Container.user.req)
        ])
        .then(function(values) {
          var path = values[0];
          var reqOpt = values[1];
          var bodyContent = values[2];

          if (typeof reqOpt !== 'object') {
            throw new ReferenceError('decorateReqOpt must return an Object.');
          }

          reqOpt.path = path;

          if (bodyContent) {
            bodyContent = Container.options.reqAsBuffer ?
              asBuffer(bodyContent, Container.options) :
              asBufferOrString(bodyContent);

            reqOpt.headers['content-length'] = getContentLength(bodyContent);

            if (bodyEncoding(Container.options)) {
              reqOpt.headers['Accept-Charset'] = bodyEncoding(Container.options);
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

  function buildProxyReq(Container) {
    var req = Container.user.req;
    var res = Container.user.res;
    var options = Container.options;

    // TODO: needs to move into resolveOptions
    var parseBody = (!options.parseReqBody) ? Promise.resolve(null) : requestOptions.bodyContent(req, res, options);
    var createReqOptions = requestOptions.create(req, res, options, host);

   return new Promise(function(resolve) {
     Promise
      .all([parseBody, createReqOptions])
      .then(function(responseArray) {
        Container.proxy.bodyContent = responseArray[0];
        Container.proxy.reqBuilder = responseArray[1];
        resolve(Container);
      });
    });
  }

  return function handleProxy(req, res, next) {
    // TODO: give container a constructor instead, i think
    Container.user.req = req;
    Container.user.res = res;
    Container.user.next = next;

    // Do not proxy request if filter returns false.
    if (!Container.options.filter(req, res)) { return next(); }

    buildProxyReq(Container)
      .then(decorateRequestWrapper) // the wrapper around request decorators.  this could use a better name
      .then(sendProxyRequest)
      //.then(copyProxyResToUserRes)
      .then(decorateUserRes)
      .then(sendUserRes)
      .catch(next);
  };


  function sendProxyRequest(Container) {
      var req = Container.user.req;
      var res = Container.user.res;
      var bodyContent = Container.proxy.bodyContent;
      var reqOpt = Container.proxy.reqBuilder;
      var options = Container.options;

      return new Promise(function(resolve, reject) {
        var protocol = parseHost(host, req, options).module;
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

function decorateUserRes(Container) {
    var rsp = Container.proxy.res;
    var res = Container.user.res;
    var rspData = Container.proxy.resData;
    var intercept = Container.options.intercept;
    var next = Container.user.next;
    var req = Container.user.req;

    if (!res.headersSent) {
        res.status(rsp.statusCode);
        Object.keys(rsp.headers)
        .filter(function(item) { return item !== 'transfer-encoding'; })
        .forEach(function(item) {
            res.set(item, rsp.headers[item]);
        });
    }

    function postIntercept(res, next, rspData) {
       // TODO: handle sent?  or is res.headersSent enough?
        return function(err, rspd /*, sent */) {
            if (err) {
                return next(err);
            }
            rspd = asBuffer(rspd, Container.options);
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
            Container.user.res = res;
            Container.proxy.resData = rspd;
            return Container;
            //if (!sent) {
                //res.send(rspd);
            //}
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
        Promise.resolve(intercept(rsp, rspData, req, res, callback));
    } else {
        Promise.resolve(Container);
        // see issue https://github.com/villadora/express-http-proxy/issues/104
        // Not sure how to automate tests on this line, so be careful when changing.
        //if (!res.headersSent) {
            //res.send(rspData);
        //}
    }


    return Container;
}

function sendUserRes(Container) {
    Promise.resolve(Container);
    if (!Container.user.res.headersSent) {
        Container.user.res.send(Container.proxy.resData);
    }
    Promise.resolve(Container);
}


