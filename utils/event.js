"use strict";

const EventEmitter = require('events');

class MarvinStatus extends EventEmitter {
    constructor() {
        super();

        this.last_error = null;
    }

    ok() {
        // Reset last error
        this.last_error = null;
    }

    error(reason) {
        reason = reason || 'unknown reason';

        // Set last error and emit event
        this.last_error = reason;
        this.emit('error', reason);
    }
}

module.exports = {
    MarvinStatus,
};
