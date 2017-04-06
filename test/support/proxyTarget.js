'use strict';

var express = require('express');
var bodyParser = require('body-parser');

function proxyTarget(port, timeout, handlers) {
  var target = express();

  timeout = timeout || 100;

  // parse application/x-www-form-urlencoded
  target.use(bodyParser.urlencoded({ extended: false }));

  // parse application/json
  target.use(bodyParser.json());

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

  target.use(function(err, req, res, next) {
    res.send(err);
    next();
  });

  target.use(function(req, res) {
    res.sendStatus(404);
  });

  return target.listen(port);
}

module.exports = proxyTarget;
