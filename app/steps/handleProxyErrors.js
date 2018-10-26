'use strict';

var debug = require('debug')('express-http-proxy');

function isTimedOut(err) {
  return err && (err.code === 'ESOCKETTIMEDOUT' || err.code === 'ETIMEDOUT');
}

function connectionResetHandler(err, res) {
  if (isTimedOut(err)) {
    debug('Error: Connection reset due to author-set timeout option.');
    res.setHeader('X-Timeout-Reason', 'express-http-proxy reset the request.');
    res.writeHead(504, { 'Content-Type': 'text/plain' });
    res.end();
  }
}

function handleProxyErrors(err, res, next) {
  switch (err && err.code) {
    case 'ETIMEDOUT':
    case 'ESOCKETTIMEDOUT':  { return connectionResetHandler(err, res, next); }
    default:                 { next(err); }
  }
}

module.exports = handleProxyErrors;
