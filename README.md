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



#### forwardPath

The ```forwardPath``` option allows you to modify the path prior to proxying the request.

```js
var proxy = require('express-http-proxy');

var app = require('express')();

app.use('/proxy', proxy('www.google.com', {
  forwardPath: function(req, res) {
    return require('url').parse(req.url).path;
  }
}));
```
#### forwardPathAsync

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
    // rsp - original response from the target
    data = JSON.parse(data.toString('utf8'));
    callback(null, JSON.stringify(data));
  }
}));
```

#### decorateRequest

You can change the request options before it is sent to the target.

```js
app.use('/proxy', proxy('www.google.com', {
  decorateRequest: function(proxyReq, originalReq) {
    // you can update headers
    proxyReq.headers['Content-Type'] = 'text/html';
    // you can change the method
    proxyReq.method = 'GET';
    // you can munge the bodyContent.
    proxyReq.bodyContent = proxyReq.bodyContent.replace(/losing/, 'winning!');
    return proxyReq;
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


#### reqAsBuffer

Note: this is an experimental feature.  ymmv

The ```reqAsBuffer``` option allows you to ensure the req body is encoded as a Node
```Buffer``` when sending a proxied request.   Any value for this is truthy.

This defaults to to false in order to preserve legacy behavior. Note that
the value of ```reqBodyEnconding``` is used as the encoding when coercing strings
(and stringified JSON) to Buffer.

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
