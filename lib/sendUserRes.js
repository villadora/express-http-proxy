'use strict';

function sendUserRes(Container) {
  Promise.resolve(Container);
  if (!Container.user.res.headersSent) {
      Container.user.res.send(Container.proxy.resData);
  }
  Promise.resolve(Container);
}


module.exports = sendUserRes;
