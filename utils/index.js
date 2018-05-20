const {MarvinError, ClientError, ServerError} = require("./exceptions");
const {sendError, sendException} = require("./send_error");

module.exports = {
    // Exceptions
    MarvinError,
    ClientError,
    ServerError,

    // Error functions
    sendError,
    sendException,
};
