var assert = require('assert');
var util = require('util');
var url = require('url');
var http = require('http');
var is = require('type-is');
var getRawBody = require('raw-body');


require('buffer');

module.exports = function proxy(host, options) {

  assert(host, 'Host should not be empty');

  options = options || {};

  var port = 80;

  if (typeof host == 'string') {
    var mc = host.match(/^(https?:\/\/)/);
    if (mc) {
      host = host.substring(mc[1].length);
    }

    var h = host.split(':');
    host = h[0];
    port = h[1] || 80;
  }


  /** 
   * intercept(data, res, req, function(err, json));
   */
  var intercept = options.intercept;
  var forwardPath = options.forwardPath;
  var filter = options.filter;

  return function handleProxy(req, res, next) {
    if (filter && !filter(req, res)) next();

    var headers = options.headers || {};
    var path;

    path = forwardPath ? forwardPath(req, res) : url.parse(req.url).path;


    var hds = extend(headers, req.headers, ['connection', 'host', 'content-length']);
    hds.connection = 'close';

    // var hasRequestBody = 'content-type' in req.headers || 'transfer-encoding' in req.headers;
    getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
    }, function(err, bodyContent) {
      if (err) return next(err)

      if (bodyContent.length)
        hds['content-length'] = bodyContent.length

      var chunks = [];
      var realRequest = http.request({
        hostname: (typeof host == 'function') ? host(req) : host.toString(),
        port: port,
        headers: hds,
        method: req.method,
        path: path
      }, function(rsp) {

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
            intercept(rspData, req, res, function(err, rsp, sent) {
              if (err) {
                return next(err);
              }
              if (!sent)
                res.send(rsp);
            });
          } else
            res.send(rspData);
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
    if (skips.indexOf(prop) == -1)
      obj[prop] = source[prop];
  }

  return obj;
};