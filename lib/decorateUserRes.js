'use strict';
var zlib = require('zlib');
var asBuffer = require('../lib/asBuffer').asBuffer;
var asBufferOrString = require('../lib/asBuffer').orString;

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

module.exports = decorateUserRes;
