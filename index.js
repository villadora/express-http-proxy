var assert = require('assert');
var util = require('util');
var url = require('url');
var http = require('http');
var https = require('https');
var is = require('type-is');
var getRawBody = require('raw-body');

require('buffer');

module.exports = function proxy(host, options) {

  assert(host, 'Host should not be empty');

  options = options || {};

  var port = 80;

  var ishttps = /^https/.test(host);

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

    // var hasRequestBody = 'content-type' in req.headers || 'transfer-encoding' in req.headers;
    getRawBody(req, {
      length: req.headers['content-length'],
      limit: limit
    }, function(err, bodyContent) {
      if (err) return next(err);

      var reqOpt = {
        hostname: (typeof host == 'function') ? host(req) : host.toString(),
        port: port,
        headers: hds,
        method: req.method,
        path: path,
        bodyContent: bodyContent,
        params: req.params
      };


      if (decorateRequest)
        reqOpt = decorateRequest(reqOpt) || reqOpt;

      bodyContent = reqOpt.bodyContent;
      delete reqOpt.bodyContent;
      delete reqOpt.params;

      if (typeof bodyContent == 'string')
        reqOpt.headers['content-length'] = Buffer.byteLength(bodyContent);
      else if (Buffer.isBuffer(bodyContent)) // Buffer
        reqOpt.headers['content-length'] = bodyContent.length;

      var chunks = [];
      var realRequest = (ishttps ? https : http).request(reqOpt, function(rsp) {
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
    });
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
