const dns = require("dns");
const ping = require("net-ping");
const sendError = require("../utils/send_error");
const {promisify} = require("util");

async function pingOnce(session, target) {
    return new Promise(resolve => {
        session.pingHost(target, (err, target, sent, rcvd) => {
            // For some reason NodeJS deadlocks when not using setTimeout ?!?!
            // Running under a debugger also makes it work, so I think this is a timing/race condition
            if (err) {
                // Errors are also valid results
                setTimeout(resolve, 1, {
                    status: err.name || err.message,
                    latency: null,
                });
            } else {
                setTimeout(resolve, 1, {
                    status: "Ok",
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

function parseOptions(body) {
    let options = {};

    // Parse input
    try {
        options.target = String(body.target || "").trim();
        options.size = Number(body.size) || 56;
        options.count = Number(body.count) || 5;
        options.timeout = Number(body.timeout) || 1000;
    }
    catch (err) {
        throw new Error("Error parsing ping4 request");
    }

    // Sanity check
    if (!options.target) {
        throw new Error("target is a required request parameter");
    }
    if (options.size < 56 || options.size > 65535) {
        throw new Error("size must be between 56 and 65535");
    }
    if (options.count < 1 || options.count > 10) {
        throw new Error("count must be between 1 and 10");
    }
    if (options.timeout < 100 || options.timeout > 10000) {
        throw new Error("timeout must be between 100 and 10000");
    }

    return options;
}

async function postPing(family, request, response, marvin, config, activity) {
    let address, addresses, resolver, options, payloadSize;

    try {
        try {
            options = parseOptions(request.body);
        } catch (err) {
            activity.failed_tasks++;
            return sendError(response, err.message, 400);
        }

        if (family === 4) {
            // noinspection JSUnresolvedVariable
            resolver = promisify(dns.resolve4);
            payloadSize = options.size - 20;
        } else if (family === 6) {
            // noinspection JSUnresolvedVariable
            resolver = promisify(dns.resolve6);
            payloadSize = options.size - 40;
        } else {
            return sendError(response, "Unknown address family", 500, family);
        }

        console.log("Pinging IPv" + family + ": " + options.target);

        try {
            addresses = await resolver(options.target);
            address = addresses[Math.floor(Math.random() * addresses.length)];
        } catch (err) {
            if (err.code === "ENOTFOUND") {
                return sendError(response, "Target does not exist", 400, options.target);
            } else if (err.code === "EBADNAME") {
                return sendError(response, "Invalid target hostname", 400, options.target);
            } else if (err.code === "ESERVFAIL") {
                return sendError(response, "Server error while resolving target hostname", 400, options.target);
            } else {
                return sendError(response, "Unable to resolve target hostname", 400, err);
            }
        }

        if (!address) {
            return sendError(response, "No IPv" + family + " addresses found", 400);
        }

        // noinspection JSUnresolvedVariable
        let session = ping.createSession({
            networkProtocol: family === 4 ? ping.NetworkProtocol.IPv4 : ping.NetworkProtocol.IPv6,
            packetSize: payloadSize,
            retries: 0,
            timeout: options.timeout,
        });

        let results = await pingHost(session, address, options.count);
        response.send({
            request: options,
            address,
            success: true,
            reason: "Test completed",
            results,
        });
    }
    catch (err) {
        sendError(response, "IPv" + family + " ping failed", 500, err);
    }
}

module.exports = {
    postPing,
};
