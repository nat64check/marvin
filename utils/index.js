"use strict";

const {MarvinError, ClientError, ServerError} = require("./exceptions");
const {MarvinStatus} = require("./event");
const {sendError, sendException} = require("./send_error");

module.exports = {
    // Exceptions
    MarvinError,
    ClientError,
    ServerError,

    // Events
    MarvinStatus,

    // Error functions
    sendError,
    sendException,
};
