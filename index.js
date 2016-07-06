var assert = require('assert');
var url = require('url');
var http = require('http');
var https = require('https');
var getRawBody = require('raw-body');

require('buffer');

module.exports = function proxy(host, options) {
  'use strict';

  assert(host, 'Host should not be empty');

  options = options || {};

  var parsedHost;

  /**
   * Function :: intercept(targetResponse, data, res, req, function(err, json));
   */
  var intercept = options.intercept;   // after request (5)
  var decorateRequest = options.decorateRequest;  // before request (2)
  var forwardPath = options.forwardPath || defaultForwardPath;  // before request (1)
  var filter = options.filter || defaultFilter;  // before request (0)
  var limit = options.limit || '1mb';  // option
  var preserveReqSession = options.preserveReqSession; // binary option

  return function handleProxy(req, res, next) {

    if (!filter(req, res)) { return next(); }

    var path = forwardPath(req, res);

    parsedHost = parsedHost || parseHost(host, req);

    if (req.body) {
      runProxy(null, req.body);
    } else {
      getRawBody(req, {
        length: req.headers['content-length'],
        limit: limit,
        encoding: bodyEncoding(options),
      }, runProxy);
    }

    function runProxy(err, bodyContent) {
      var reqOpt = {
        hostname: parsedHost.host,
        port: options.port || parsedHost.port,
        headers: reqHeaders(req, options),
        method: req.method,
        path: path,
        bodyContent: bodyContent,
        params: req.params,
      };

      if (preserveReqSession) {
        reqOpt.session = req.session;
      }

      if (decorateRequest) {
        reqOpt = decorateRequest(reqOpt, req) || reqOpt;
      }

      bodyContent = reqOpt.bodyContent;
      delete reqOpt.bodyContent;
      delete reqOpt.params;

      if (err && !bodyContent) {
        return next(err);
      }

      if (typeof bodyContent === 'string') {
        reqOpt.headers['content-length'] = Buffer.byteLength(bodyContent);
      } else if (Buffer.isBuffer(bodyContent)) { // Buffer
        reqOpt.headers['content-length'] = bodyContent.length;
      }

      var realRequest = parsedHost.module.request(reqOpt, function(rsp) {
        var chunks = [];

        rsp.on('data', function(chunk) {
          chunks.push(chunk);
        });

        rsp.on('end', function() {

          var rspData = Buffer.concat(chunks, length(chunks));

          if (intercept) {
            intercept(rsp, rspData, req, res, function(err, rspd, sent) {
              if (err) {
                return next(err);
              }

              var encode = 'utf8';

              if (typeof rspd === 'string') {
                rspd = new Buffer(rspd, encode);
              }

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
            });
          } else {
            res.send(rspData);
          }
        });

        rsp.on('error', function(e) {
          next(e);
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

      realRequest.on('socket', function(socket) {
        if (options.timeout) {
          socket.setTimeout(options.timeout, function() {
            realRequest.abort();
          });
        }
      });

      realRequest.on('error', function(err) {
        if (err.code === 'ECONNRESET') {
          res.setHeader('X-Timout-Reason',
            'express-http-proxy timed out your request after ' +
            options.timeout + 'ms.');
          res.writeHead(504, {'Content-Type': 'text/plain'});
          res.end();
          next();
        } else {
          next(err);
        }
      });

      if (bodyContent.length) {
        realRequest.write(bodyContent);
      }

      realRequest.end();
    }
  };
};



function extend(obj, source, skips) {
  'use strict';

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

function parseHost(host, req) {
  'use strict';

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

  var ishttps = parsed.protocol === 'https:';

  return {
    host: parsed.hostname,
    port: parsed.port || (ishttps ? 443 : 80),
    module: ishttps ? https : http,
  };
}

function reqHeaders(req, options) {
  'use strict';

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
  'use strict';
  return true;
}

function defaultForwardPath(req) {
  'use strict';
  return url.parse(req.url).path;
}

function bodyEncoding(options) {
  'use strict';

  /* For reqBodyEncoding, these is a meaningful difference between null and
   * undefined.  null should be passed forward as the value of reqBodyEncoding,
   * and undefined should result in utf-8.
   */

  return options.reqBodyEncoding !== undefined ? options.reqBodyEncoding: 'utf-8';
}

function length(chunks) {
  'use strict';

  return chunks.reduce(function(len, buf) {
    return len + buf.length;
  }, 0);
}
