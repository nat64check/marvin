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

module.exports = sendError;
