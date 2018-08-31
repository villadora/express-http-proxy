'use strict';

function continueToExpressAtEnd(container) {
    var resolverFn = container.options.skipToNextHandlerFilter || defaultSkipFilter;

    return new Promise
        .resolve()
        .then(function() {
            if (container.options.continueToExpressAtEnd) {
                container.user.next();
            }
        })
        .catch(Promise.reject);
}

module.exports = continueToExpressAtEnd;
