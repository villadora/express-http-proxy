'use strict';

function continueToExpressAtEnd(container) {

  return Promise
    .resolve()
    .then(function () {
      if (container.options.continueToExpressAtEnd) {
        container.user.next();
      }
    })
    .catch(Promise.reject);
}

module.exports = continueToExpressAtEnd;
