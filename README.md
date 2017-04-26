# express-http-proxy [![NPM version](https://badge.fury.io/js/express-http-proxy.svg)](http://badge.fury.io/js/express-http-proxy) [![Build Status](https://travis-ci.org/villadora/express-http-proxy.svg?branch=master)](https://travis-ci.org/villadora/express-http-proxy) [![Dependency Status](https://gemnasium.com/villadora/express-http-proxy.svg)](https://gemnasium.com/villadora/express-http-proxy)

Express middleware to proxy request to another host and pass response back to original caller.

## NOTE: version 1.0.0 released: breaking changes, transition guide at bottom of doc. 

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

#### proxyReqPathResolver (supports Promises)

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
      setTimeout(function () {   // do asyncness
        resolve(fancyResults);
      }, 200);
    });
  }
}));
```

#### forwardPath

DEPRECATED.  See proxyReqPathResolver

#### forwardPathAsync

DEPRECATED. See proxyReqPathResolver

#### filter

The ```filter``` option can be used to limit what requests are proxied.  Return ```true``` to execute proxy.

For example, if you only want to proxy get request:

```js
app.use('/proxy', proxy('www.google.com', {
  filter: function(req, res) {
     return req.method == 'GET';
  }
}));
```

#### userResDecorator (was: intercept) (supports Promise)

You can modify the proxy's response before sending it to the client.

##### exploiting references
The intent is that this be used to modify the proxy response data only.

Note:
The other arguments (proxyRes, userReq, userRes) are passed by reference, so
you *can* currently exploit this to modify either response's headers, for
instance, but this is not a reliable interface. I expect to close this
exploit in a future release, while providing an additional hook for mutating
the userRes before sending.

##### gzip responses

If your proxy response is gzipped, this program will automatically unzip
it before passing to your function, then zip it back up before piping it to the
user response.  There is currently no way to short-circuit this behavior.

```js
app.use('/proxy', proxy('www.google.com', {
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
    data = JSON.parse(proxyResData.toString('utf8'));
    data.newProperty = 'exciting data';
    return JSON.stringify(data);
  }
}));
```

```js
app.use(proxy('httpbin.org', {
  userResDecorator: function(proxyRes, proxyResData) {
    return new Promise(function(resolve) {
      proxyResData.funkyMessage = 'oi io oo ii';
      setTimeout(function() {
        resolve(proxyResData);
      }, 200);
    });
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
memoized for subsequent requests.

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

REMOVED:  See ```proxyReqOptDecorator``` and ```decorateProxyReqBody```.

#### proxyReqOptDecorator  (supports Promise form)

You can mutate the request options before sending the proxyRequest.
proxyReqOpt represents the options argument passed to the (http|https).request
module.

```js
app.use('/proxy', proxy('www.google.com', {
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    // you can update headers
    proxyReqOpts.headers['Content-Type'] = 'text/html';
    // you can change the method
    proxyReqOpts.method = 'GET';
    // you could change the path
    proxyReqOpts.path = 'http://dev/null'
    return proxyReqOpts;
  }
}));
```

You can use a Promise for async style.

```js
app.use('/proxy', proxy('www.google.com', {
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    return new Promise(function(resolve, reject) {
      proxyReqOpts.headers['Content-Type'] = 'text/html';
      resolve(proxyReqOpts);
    })
  }
}));
```

#### decorateProxyReqBody  (supports Promise form)

You can mutate the body content before sending the proxyRequest.

```js
app.use('/proxy', proxy('www.google.com', {
  decorateProxyReqBody: function(bodyContent, srcReq) {
    return bodyContent.split('').reverse().join('');
  }
}));
```

You can use a Promise for async style.

```js
app.use('/proxy', proxy('www.google.com', {
  decorateProxyReqBody: function(proxyReq, srcReq) {
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
For example, disabling body parsing is useful for large uploads where it would be inefficient
to hold the data in memory.

This defaults to true in order to preserve legacy behavior. 

When false, no action will be taken on the body and accordingly ```req.body``` will no longer be set.

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

By default, node does not express a timeout on connections.   
Use timeout option to impose a specific timeout.    
Timed-out requests will respond with 504 status code and a X-Timeout-Reason header.

```js
app.use('/', proxy('httpbin.org', {
  timeout: 2000  // in milliseconds, two seconds
}));
```

##  Trace debugging

The node-debug module is used to provide a trace debugging capability.

```
DEBUG=express-http-proxy npm run YOUR_PROGRAM
DEBUG=express-http-proxy npm run YOUR_PROGRAM  | grep 'express-http-proxy'   # to filter down to just these messages
```

Will trace the execution of the express-http-proxy module in order to aide debugging.




## Upgrade to 1.0, transition guide and breaking changes

1.
```decorateRequest``` has been REMOVED, and will generate an error when called.  See ```proxyReqOptDecorator``` and ```decorateProxyReqBody```.

Resolution:  Most authors will simply need to change the method name for their
decorateRequest method;  if author was decorating reqOpts and reqBody in the
same method, this will need to be split up.


2.
```intercept``` has been REMOVED, and will generate an error when called.  See ```userResDecorator```.

Resolution:  Most authors will simply need to change the method name from ```intercept``` to ```userResDecorator```, and exit the method by returning the value, rather than passing it to a callback.   E.g.:

Before:

```js
app.use('/proxy', proxy('www.google.com', {
  intercept: function(proxyRes, proxyResData, userReq, userRes, cb) {
    data = JSON.parse(proxyResData.toString('utf8'));
    data.newProperty = 'exciting data';
    cb(null,  JSON.stringify(data));
  }
}));
```

Now:

```js
app.use('/proxy', proxy('www.google.com', {
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
    data = JSON.parse(proxyResData.toString('utf8'));
    data.newProperty = 'exciting data';
    return JSON.stringify(data);
  }
}));
```

3.
```forwardPath``` and ```forwardPathAsync``` have been DEPRECATED and will generate a warning when called.  See ```proxyReqPathResolver```.

Resolution:  Simple update the name of either ```forwardPath``` or ```forwardPathAsync``` to ```proxyReqPathResolver```.

## Questions

### Q: Does it support https proxy?

The library will automatically use https if the provided path has 'https://' or ':443'.  You may also set option ```https``` to true to alwyas use https.

You can use ```proxyReqOptDecorator``` to ammend any auth or challenge headers required to succeed https.

### Q: How can I support non-standard certificate chains?

You can use the ability to decorate the proxy request prior to sending.    See ```proxyReqOptDecorators``` for more details.

```js
app.use('/', proxy('internalhost.example.com', {
  proxyReqOptDecorators: function(proxyReqOpts, originalReq) {
    proxyReqOpts.ca =  [caCert, intermediaryCert]
    return proxyReqOpts;
  }
})
```



## Release Notes

| Release | Notes |
| --- | --- |
| 1.0.1 | Minor docs adjustments. |
| 1.0.0 | Major revision.  <br > REMOVE decorateRequest, ADD proxyReqOptDecorator and decorateProxyReqBody. <br />  REMOVE intercept, ADD userResDecorator <br />  userResDecorator supports a Promise form for async operations.  <br /> General cleanup of structure and application of hooks.  Documentation improvements.   Update all dependencies.  Re-organize code as a series of workflow steps, each (potentially) supporting a promise, and creating a reusable pattern for future development. |
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
