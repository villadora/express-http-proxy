'use strict';

var express = require('express');

function proxyTarget(port, timeout, handlers) {
  var target = express();

  timeout = 1000 || timeout;

  target.use(function(req, res, next) {
    setTimeout(function() {
      next();
    },timeout);
  });

  if (handlers) {
    handlers.forEach(function(handler) {
      target[handler.method](handler.path, handler.fn);
    });
  }

  target.post('/post', function(req, res) {
    req.pipe(res);
  });

  target.use(function(err, req, res) {
    res.send(err);
  });

  target.use(function(req, res) {
    res.sendStatus(404);
  });


  return target.listen(port);
}

module.exports = proxyTarget;
