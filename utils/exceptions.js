"use strict";

class MarvinError extends Error {
    constructor(message, reason) {
        // noinspection JSCheckFunctionSignatures
        super(message);

        this.reason = reason;
        this.httpStatus = 500;
    }
}

class ClientError extends MarvinError {
    constructor(message, reason, code) {
        super(message, reason);

        // noinspection JSUnusedGlobalSymbols
        this.httpStatus = code || 400;
    }
}

class ServerError extends MarvinError {
    constructor(message, reason, code) {
        super(message, reason);

        // noinspection JSUnusedGlobalSymbols
        this.httpStatus = code || 500;
    }
}

module.exports = {
    MarvinError,
    ClientError,
    ServerError,
};
