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
var zlib = require('zlib');
var ScopeContainer = require('./lib/scopeContainer');
var asBuffer = require('./lib/asBuffer').asBuffer;
var decorateRequestWrapper = require('./lib/decorateRequestWrapper');
var buildProxyReq = require('./lib/buildProxyReq');
var resolveProxyHost = require('./lib/resolveProxyHost');
var sendProxyRequest = require('./lib/sendProxyRequest');

module.exports = function proxy(host, userOptions) {
  assert(host, 'Host should not be empty');

  return function handleProxy(req, res, next) {
    // TODO: lowercase
    var Container = new ScopeContainer(req, res, next, host, userOptions);

    // Do not proxy request if filter returns false.
    if (!Container.options.filter(req, res)) { return next(); }

    buildProxyReq(Container)
      //.then(determineProtocol)
      .then(resolveProxyHost)
      .then(decorateRequestWrapper) // the wrapper around request decorators.  this could use a better name
      .then(sendProxyRequest)
      //.then(copyProxyResToUserRes)  // add this step by separaing decorateUserRes
      .then(decorateUserRes)
      .then(sendUserRes)
      .catch(next);
  };

};

// Utility methods from here on down.


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


