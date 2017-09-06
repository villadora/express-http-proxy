'use strict';

function sendUserRes(Container) {
  if (!Container.user.res.headersSent) {
    Container.user.res.send(Container.proxy.resData);
  }
  return Promise.resolve(Container);
}


module.exports = sendUserRes;
