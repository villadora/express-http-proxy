var assert = require('assert');
var util = require('util');
var url = require('url');
var http = require('http');
var https = require('https');
var getRawBody = require('raw-body');
var isError = require('lodash.iserror');

require('buffer');

module.exports = function proxy(host, options) {

  assert(host, 'Host should not be empty');

  options = options || {};

  var port = 80;

  var ishttps = /^https/.test(host) || !!options.https;

  if (typeof host == 'string') {
    var mc = host.match(/^(https?:\/\/)/);
    if (mc) {
      host = host.substring(mc[1].length);
    }

    var h = host.split(':');
    if (h[1] === '443') {
      ishttps = true;
    }

    host = h[0];
    port = h[1] || (ishttps ? 443 : 80);
    port = String.prototype.replace.call(port, '/', '');
    } else {
      port = ishttps ? 443 : 80;
    }

  port = options.port || port;

  /**
   * intercept(targetResponse, data, res, req, function(err, json));
   */
  var intercept = options.intercept;
  var decorateRequest = options.decorateRequest;
  var forwardPath = options.forwardPath;
  var filter = options.filter;
  var limit = options.limit || '1mb';
  var preserveHostHdr = options.preserveHostHdr;
  var preserveReqSession = options.preserveReqSession;

  return function handleProxy(req, res, next) {
    if (filter && !filter(req, res)) return next();

    var headers = options.headers || {};
    var path;

    path = forwardPath ? forwardPath(req, res) : url.parse(req.url).path;

    var skipHdrs = [ 'connection', 'content-length' ];
    if (!preserveHostHdr) {
      skipHdrs.push('host');
    }
    var hds = extend(headers, req.headers, skipHdrs);
    hds.connection = 'close';

    var parsedHost = parseHost((typeof host == 'function') ? host(req) : host.toString());
    if (isError(parsedHost))
      next(parsedHost);

    // var hasRequestBody = 'content-type' in req.headers || 'transfer-encoding' in req.headers;
    // Support for body-parser or other modules which already consume the req and store the result in req.body
    if (req.body) {
      runProxy(null, req.body);
    } else {
      getRawBody(req, {
        length: req.headers['content-length'],
        limit: limit,
        encoding: 'utf-8'
      }, runProxy);
    }

    function runProxy(err, bodyContent) {
      var reqOpt = {
        hostname: parsedHost.host,
        port: options.port || parsedHost.port,
        headers: hds,
        method: req.method,
        path: path,
        bodyContent: bodyContent,
        params: req.params
      };

      if (preserveReqSession) {
        reqOpt.session = req.session;
      }

      if (decorateRequest)
        reqOpt = decorateRequest(reqOpt, req) || reqOpt;

      bodyContent = reqOpt.bodyContent;
      delete reqOpt.bodyContent;
      delete reqOpt.params;
      
      if (err && !bodyContent) return next(err);

      if (typeof bodyContent == 'string')
        reqOpt.headers['content-length'] = Buffer.byteLength(bodyContent);
      else if (Buffer.isBuffer(bodyContent)) // Buffer
        reqOpt.headers['content-length'] = bodyContent.length;

      var chunks = [];
      var realRequest = parsedHost.module.request(reqOpt, function(rsp) {
        var rspData = null;
        rsp.on('data', function(chunk) {
          chunks.push(chunk);
        });

        rsp.on('end', function() {
          var totalLength = chunks.reduce(function(len, buf) {
            return len + buf.length;
          }, 0);

          var rspData = Buffer.concat(chunks, totalLength);

          if (intercept) {
            intercept(rsp, rspData, req, res, function(err, rspd, sent) {
              if (err) {
                return next(err);
              }

              var encode = 'utf8';
              if (rsp.headers && rsp.headers['content-type']) {
                var contentType = rsp.headers['content-type'];
                if (/charset=/.test(contentType)) {
                  var attrs = contentType.split(';').map(function(str) { return str.trim(); });
                  for(var i = 0, len = attrs.length; i < len; i++) {
                      var attr = attrs[i];
                    if (/charset=/.test(attr)) {
                      // encode = attr.split('=')[1];
                      break;
                    }
                  }
                }
              }

              if (typeof rspd == 'string')
                rspd = new Buffer(rspd, encode);

              if (!Buffer.isBuffer(rspd)) {
                next(new Error("intercept should return string or buffer as data"));
              }

              if (!res.headersSent)
                res.set('content-length', rspd.length);
              else if (rspd.length != rspData.length) {
                next(new Error("'Content-Length' is already sent, the length of response data can not be changed"));
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


        if (!res.headersSent) { // if header is not set yet
          res.status(rsp.statusCode);
          for (var p in rsp.headers) {
            if (p == 'transfer-encoding')
              continue;
            res.set(p, rsp.headers[p]);
          }
        }

      });

      realRequest.on('error', function(e) {
        next(e);
      });

      if (bodyContent.length) {
        realRequest.write(bodyContent);
      }

      realRequest.end();
    }
  };
};


function extend(obj, source, skips) {
  if (!source) return obj;

  for (var prop in source) {
    if (!skips || skips.indexOf(prop) == -1)
      obj[prop] = source[prop];
  }

  return obj;
}

function parseHost(host) {
  if (!host) {
    return new Error("Empty host parameter");
  }

  if (!/http(s)?:\/\//.test(host)) {
    host = "http://" + host;
  }

  var parsed = url.parse(host);
  if (! parsed.hostname) {
    return new Error("Unable to parse hostname, possibly missing protocol://?");
  }

  var ishttps = parsed.protocol === 'https:';

  return {
    host: parsed.hostname,
    port: parsed.port || (ishttps ? 443 : 80),
    module: ishttps ? https : http
  };
}
