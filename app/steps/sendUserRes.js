'use strict';
// https://medium.freecodecamp.org/node-js-streams-everything-you-need-to-know-c9141306be93

function sendUserRes(Container) {
  if (!Container.user.res.headersSent) {
    // TODO: I've killed streaming for the moment and plan to reimplement it
    // once the base cases are working as expected.
    if (false && Container.options.stream) {
      Container.proxy.resData.pipe(Container.user.res);
    } else {
      Container.user.res.send(Container.proxy.resData);
    }
  }
  return Promise.resolve(Container);
}


module.exports = sendUserRes;
