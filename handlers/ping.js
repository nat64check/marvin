"use strict";

const dns = require("dns");
const ping = require("net-ping");
const {promisify} = require("util");
const {ClientError, ServerError} = require("../utils");
const {Address4, Address6} = require('ip-address');

async function pingOnce(session, target) {
    return new Promise(resolve => {
        session.pingHost(target, (err, target, sent, rcvd) => {
            // For some reason NodeJS deadlocks when not using setTimeout ?!?!
            // Running under a debugger also makes it work, so I think this is a timing/race condition
            if (err) {
                // Errors are also valid results
                setTimeout(resolve, 1, {
                    status: err.message.toLowerCase(),
                    latency: null,
                });
            } else {
                setTimeout(resolve, 1, {
                    status: "ok",
                    latency: rcvd - sent,
                });
            }
        });
    });
}

async function pingHost(session, target, count) {
    let requests = [];
    for (let i = 0; i < count; i++) {
        if (i > 0) {
            // Sleep for one seconds between sending pings
            await new Promise(res => setTimeout(res, 1000));
        }
        requests.push(pingOnce(session, target));
    }
    return Promise.all(requests);
}

function parsePingRequest(request) {
    let options = {};

    // Parse input
    try {
        options.target = String(request.body.target || "").trim();
        options.size = Number(request.body.size) || 56;
        options.count = Number(request.body.count) || 5;
        options.timeout = Number(request.body.timeout) || 1000;
    }
    catch (err) {
        throw new ClientError("Error parsing ping4 request", err);
    }

    // Sanity check
    if (!options.target) {
        throw new ClientError("target is a required request parameter", options);
    }
    if (options.size < 56 || options.size > 65535) {
        throw new ClientError("size must be between 56 and 65535", options);
    }
    if (options.count < 1 || options.count > 10) {
        throw new ClientError("count must be between 1 and 10", options);
    }
    if (options.timeout < 100 || options.timeout > 10000) {
        throw new ClientError("timeout must be between 100 and 10000", options);
    }

    return options;
}

async function doPing(family, options) {
    let address, addresses, resolver, payloadSize;

    if (family === 4) {
        // noinspection JSUnresolvedVariable
        resolver = promisify(dns.resolve4);
        payloadSize = options.size - 20;
        address = new Address4(options.target);
    } else if (family === 6) {
        // noinspection JSUnresolvedVariable
        resolver = promisify(dns.resolve6);
        payloadSize = options.size - 40;
        address = new Address6(options.target);
    } else {
        throw new ServerError("Unknown address family", family);
    }

    if (address.isValid()) {
        // We got a valid address literal, just use it
        address = address.correctForm();
    } else {
        // It's not a valid address literal, try to resolve it as a hostname
        try {
            addresses = await resolver(options.target);
            address = addresses[Math.floor(Math.random() * addresses.length)];
        }
        catch (err) {
            if (err.code === "ENOTFOUND") {
                throw new ClientError("Target does not exist", options.target);
            } else if (err.code === "EBADNAME") {
                throw new ClientError("Invalid target hostname", options.target);
            } else if (err.code === "ESERVFAIL") {
                throw new ClientError("Server error while resolving target hostname", options.target);
            } else {
                throw new ClientError("Unable to resolve target hostname", err);
            }
        }
    }

    console.log("Pinging IPv" + family + ": " + options.target + ' (' + address + ')');

    if (!address) {
        throw new ClientError("No IPv" + family + " addresses found");
    }

    // noinspection JSUnresolvedVariable
    let session = ping.createSession({
        networkProtocol: family === 4 ? ping.NetworkProtocol.IPv4 : ping.NetworkProtocol.IPv6,
        packetSize: payloadSize,
        retries: 0,
        timeout: options.timeout,
    });

    let results = await pingHost(session, address, options.count);
    return {
        request: options,
        address,
        results,
    };
}

module.exports = {
    parsePingRequest,
    doPing,
};
