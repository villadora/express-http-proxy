
'use strict';

function optionalNext(container, next) {
    if (container.params && container.params.userOptions && container.params.userOptions.optionalNext) {
        next();
        return Promise.resolve();
    }
    else return Promise.resolve();
}

module.exports = optionalNext;
