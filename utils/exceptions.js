class MarvinError extends Error {
    constructor(message, reason) {
        // noinspection JSCheckFunctionSignatures
        super(message);

        this.reason = reason ? reason : message;
        this.httpStatus = 500;
    }
}

class ClientError extends MarvinError {
    constructor(message, reason) {
        super(message, reason);

        // noinspection JSUnusedGlobalSymbols
        this.httpStatus = 400;
    }
}

class ServerError extends MarvinError {
    constructor(message, reason) {
        super(message, reason);

        // noinspection JSUnusedGlobalSymbols
        this.httpStatus = 500;
    }
}

module.exports = {
    MarvinError,
    ClientError,
    ServerError,
};
