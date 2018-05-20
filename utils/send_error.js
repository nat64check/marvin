const {MarvinError} = require("./exceptions");

/**
 * Send an error to the client
 *
 * @param {Response} response
 * @param {string} message
 * @param {number} [code]
 * @param {*|object} [reason]
 */
function sendError(response, message, code, reason) {
    if (reason) {
        console.error("ERROR: " + message + " (" + reason + ")");
    } else {
        console.error("ERROR: " + message);
    }

    response.status(code || 500).json({
        success: false,
        reason: message,
    });
}

/**
 * Send an error based on an exception to the client
 *
 * @param {Response} response
 * @param {Error} error
 */
function sendException(response, error) {
    if (error instanceof MarvinError) {
        sendError(response, error.message, error.httpStatus, error.reason);
    } else {
        sendError(response, error.message);
    }
}

module.exports = {
    sendError,
    sendException,
};
