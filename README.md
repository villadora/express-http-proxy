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
  decorateRequest: function(reqOpt, req) {
    reqOpt.headers['Content-Type'] = '';
    reqOpt.method = 'GET';
    reqOpt.bodyContent = wrap(req.bodyContent);
    return reqOpt;
  }
}));

```

#### preserveHostHdr

You can copy the host HTTP header to the proxied express server using the `preserveHostHdr` option.

```
app.use('/proxy', proxy('www.google.com', {
  preserveHostHdr: true
}));
```

#### reqBodyEncoding

Encoding used to decode request body. Default to ```utf-8```.

Use ```null``` to avoid decoding and pass the body as is.
Accept any values supported by [raw-body](https://www.npmjs.com/package/raw-body#readme).

```
app.use('/post', proxy('httpbin.org', {
  reqBodyEncoding: null
}));
```

## Questions

### Q: Can it support https proxy?

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
| 0.7.2 | Collecting many minor documentation and test improvements. |
| 0.4.0 | Signature of `intercept` callback changed from `function(data, req, res, callback)` to `function(rsp, data, req, res, callback)` where `rsp` is the original response from the target |

## Licence

MIT
<!-- do not want to make nodeinit to complicated, you can edit this whenever you want. -->
