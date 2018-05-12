function sendError(response, message, code, reason) {
    console.error("ERROR: " + reason || message);
    response.status(code || 500).json({
        success: false,
        reason: message,
    });
}

module.exports = sendError;
