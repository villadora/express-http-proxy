# express-http-proxy [![NPM version](https://badge.fury.io/js/express-http-proxy.svg)](http://badge.fury.io/js/express-http-proxy) [![Build Status](https://travis-ci.org/villadora/express-http-proxy.svg?branch=master)](https://travis-ci.org/villadora/express-http-proxy) [![Dependency Status](https://gemnasium.com/villadora/express-http-proxy.svg)](https://gemnasium.com/villadora/express-http-proxy)

Express proxy middleware to forward request to another host and pass response back

## Install

```bash
$ npm install express-http-proxy --save
```

## Usage
```js
proxy(host, options);
```

To proxy URLS starting with '/proxy' to the host 'www.google.com':

```js
var proxy = require('express-http-proxy');

var app = require('express')();

app.use('/proxy', proxy('www.google.com'));
```

### Options


#### proxyReqPathResolver

Provide a proxyReqPathResolver function if you'd like to
operate on the path before issuing the proxy request.  Use a Promise for async
operations.

```js
app.use('/proxy', proxy('localhost:12345', {
  proxyReqPathResolver: function(req) {
    return require('url').parse(req.url).path;
  }
}));
```

Promise form

```js
app.use('/proxy', proxy('localhost:12345', {
  proxyReqPathResolver: function(req) {
    return new Promise(function (resolve, reject) {
      // do asyncness
      resolve(fancyResults);
    });
  }
}));
```

#### forwardPath

DEPRECATED.  See proxyReqPathResolver

The ```forwardPath``` option allows you to modify the path prior to proxying the request.

```js
var proxy = require('express-http-proxy');

var app = require('express')();

app.use('/proxy', proxy('www.google.com', {
  forwardPath: function(req) {
    return require('url').parse(req.url).path;
  }
}));
```
#### forwardPathAsync

DEPRECATED. See proxyReqPathResolver

The ```forwardPathAsync``` options allows you to modify the path asyncronously prior to proxying the request, using Promises.

```js
app.use(proxy('httpbin.org', {
  forwardPathAsync: function() {
    return new Promise(function(resolve, reject) {
      // ...
      // eventually
      resolve( /* your resolved forwardPath as string */ )
    });
  }
}));
```

#### filter

The ```filter``` option can be used to limit what requests are proxied. For example, if you only want to proxy get request

```js
app.use('/proxy', proxy('www.google.com', {
  filter: function(req, res) {
     return req.method == 'GET';
  },
  forwardPath: function(req, res) {
    return require('url').parse(req.url).path;
  }
}));
```

#### intercept

You can intercept the response before sending it back to the client.

```js
app.use('/proxy', proxy('www.google.com', {
  intercept: function(rsp, data, req, res, callback) {
    // rsp - original response from the proxy
    data = JSON.parse(data.toString('utf8'));
    callback(null, JSON.stringify(data));
  }
}));
```

#### limit

This sets the body size limit (default: `1mb`). If the body size is larger than the specified (or default) limit,
a `413 Request Entity Too Large`  error will be returned. See [bytes.js](https://www.npmjs.com/package/bytes) for
a list of supported formats.

```js
app.use('/proxy', proxy('www.google.com', {
  limit: '5mb'
}));
```

#### memoizeHost

Defaults to ```true```.

When true, the ```host``` argument will be parsed on first request, and
memoized for all subsequent requests.

When ```false```, ```host``` argument will be parsed on each request.

E.g.,

```js

  function coinToss() { return Math.random() > .5 }
  function getHost() { return coinToss() ? 'http://yahoo.com' : 'http://google.com' }

  app.use(proxy(getHost, {
    memoizeHost: false
  }))
```

In this example, when ```memoizeHost:false```, the coinToss occurs on each
request, and each request could get either value.

Conversely, When ```memoizeHost:true```,  the coinToss would occur on the first
request, and all additional requests would return the value resolved on the
first request.


#### decorateRequest

REMOVED:  See ```decorateReqOpt``` and ```decorateReqBody```.

#### decorateReqOpt

You can mutate the request options before sending the proxyRequest.

```js
app.use('/proxy', proxy('www.google.com', {
  decorateReqOpt: function(proxyReq, srcReq) {
    // you can update headers
    proxyReq.headers['Content-Type'] = 'text/html';
    // you can change the method
    proxyReq.method = 'GET';
    // you could change the path
    proxyReq.path = 'http://dev/null'
    return proxyReq;
  }
}));
```

You can use a Promise for async style.

```js
app.use('/proxy', proxy('www.google.com', {
  decorateReqOpt: function(proxyReq, srcReq) {
    return new Promise(function(resolve, reject) {
      proxyReq.headers['Content-Type'] = 'text/html';
      resolve(proxyReq);
    })
  }
}));
```

#### decorateReqBody

You can mutate the body content before sending the proxyRequest.

```js
app.use('/proxy', proxy('www.google.com', {
  decorateReqBody: function(bodyContent, srcReq) {
    return bodyContent.split('').reverse().join('');
  }
}));
```

You can use a Promise for async style.

```js
app.use('/proxy', proxy('www.google.com', {
  decorateReqBody: function(proxyReq, srcReq) {
    return new Promise(function(resolve, reject) {
      http.get('http://dev/null', function (err, res) {
        if (err) { reject(err); }
        resolve(res);
      });
    })
  }
}));
```

#### https

Normally, your proxy request will be made on the same protocol as the original
request.  If you'd like to force the proxy request to be https, use this
option.

```js
app.use('/proxy', proxy('www.google.com', {
  https: true
}));
```

#### preserveHostHdr

You can copy the host HTTP header to the proxied express server using the `preserveHostHdr` option.

```js
app.use('/proxy', proxy('www.google.com', {
  preserveHostHdr: true
}));
```

#### parseReqBody

The ```parseReqBody``` option allows you to control parsing the request body.
Disabling body parsing is useful for large uploads where it would be inefficient
to hold the data in memory.

This defaults to true in order to preserve legacy behavior. When false, no action will be taken on the body and accordingly ```req.bodyContent``` will no longer be set.

Note that setting this to false overrides ```reqAsBuffer``` and ```reqBodyEncoding``` below.

```js
app.use('/proxy', proxy('www.google.com', {
  parseReqBody: false
}));
```


#### reqAsBuffer

Note: this is an experimental feature.  ymmv

The ```reqAsBuffer``` option allows you to ensure the req body is encoded as a Node
```Buffer``` when sending a proxied request.   Any value for this is truthy.

This defaults to to false in order to preserve legacy behavior. Note that
the value of ```reqBodyEnconding``` is used as the encoding when coercing strings
(and stringified JSON) to Buffer.

Ignored if ```parseReqBody``` is set to false.

```js
app.use('/proxy', proxy('www.google.com', {
  reqAsBuffer: true
}));
```

#### reqBodyEncoding

Encoding used to decode request body. Defaults to ```utf-8```.

Use ```null``` to preserve as Buffer when proxied request body is a Buffer. (e.g image upload)
Accept any values supported by [raw-body](https://www.npmjs.com/package/raw-body#readme).

The same encoding is used in the intercept method.

Ignored if ```parseReqBody``` is set to false.

```js
app.use('/post', proxy('httpbin.org', {
  reqBodyEncoding: null
}));
```


#### timeout

By default, node does not express a timeout on connections.   Use timeout option to impose a specific timeout.    Timed-out requests will respond with 504 status code and a X-Timeout-Reason header.

```js
app.use('/', proxy('httpbin.org', {
  timeout: 2000  // in milliseconds, two seconds
}));
```


## Questions

### Q: Can it support https proxy?

The library will use https if the provided path has 'https://' or ':443'.   You can use decorateRequest to ammend any auth or challenge headers required to succeed https.


Here is an older answer about using the https-proxy-agent package.   It may be useful if the included functionality in ```http-express-proxy``` does not solve your use case.

A:  Yes, you can use the 'https-proxy-agent' package. Something like this:

```js
var corporateProxyServer = process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.https_proxy;

if (corporateProxyServer) {
  corporateProxyAgent = new HttpsProxyAgent(corporateProxyServer);
}
```

Then inside the decorateRequest method, add the agent to the request:

```js
  req.agent = corporateProxyAgent;
```

## Release Notes

| Release | Notes |
| --- | --- |
| UNRELEASED MAJOR REV | REMOVE decorateRequest, ADD decorateReqOpts and decorateReqBody |
| 0.11.0 | Allow author to prevent host from being memoized between requests.   General program cleanup. |
| 0.10.1| Fixed issue where 'body encoding' was being incorrectly set to the character encoding. <br />  Dropped explicit support for node 0.10. <br />   Intercept can now deal with gziped responses. <br />   Author can now 'force https', even if the original request is over http. <br />  Do not call next after ECONNRESET catch. |
| 0.10.0 | Fix regression in forwardPath implementation. |
| 0.9.1 | Documentation updates.  Set 'Accept-Encoding' header to match bodyEncoding. |
| 0.9.0 | Better handling for request body when body is JSON. |
| 0.8.0 | Features:  add forwardPathAsync option <br />Updates:  modernize dependencies <br />Fixes: Exceptions parsing proxied response causes error: Can't set headers after they are sent. (#111) <br />If client request aborts, proxied request is aborted too (#107) |
| 0.7.4 | Move jscs to devDependencies to avoid conflict with nsp. |
| 0.7.3 | Adds a timeout option.   Code organization and small bug fixes. |
| 0.7.2 | Collecting many minor documentation and test improvements. |
| 0.4.0 | Signature of `intercept` callback changed from `function(data, req, res, callback)` to `function(rsp, data, req, res, callback)` where `rsp` is the original response from the target |

## Licence

MIT
<!-- do not want to make nodeinit to complicated, you can edit this whenever you want. -->
