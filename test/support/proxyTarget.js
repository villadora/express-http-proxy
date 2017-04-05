'use strict';

var express = require('express')
var chunkLength = require('../../lib/chunkLength');

function proxyTarget(port, timeout, handlers) {
  var target = express();

  timeout = 1000 || timeout;

  target.use(function(req, res, next) {
    setTimeout(function() {
      next();
    },timeout);
  });

  if (handlers) {
    handlers.forEach(function (handler) {
      target[handler.method](handler.path, handler.fn);
    });
  }

  target.post('/post', function (req, res, next) {
    req.pipe(res);
  });

  target.use(function (err, req, res, next) {
    res.send(err);
  });

  target.use(function (req, res, next) {
    res.sendStatus(404);
  });


  return target.listen(port);
}

module.exports = proxyTarget;
