#!/usr/bin/env node
const Puppeteer = require("puppeteer");
const express = require("express");
const os = require("os");
const dns = require("dns");
const defaultGateway = require("default-gateway");
const {promisify} = require("util");
const {sendError, sendException} = require("./utils");

const {getInfo} = require("./handlers/info");
const {parseBrowseRequest, doBrowse} = require("./handlers/browse");
const {getSelfTest} = require("./handlers/self_test");
const {parsePingRequest, doPing} = require("./handlers/ping");

const config = require("./config");
const port = config.puppeteer.port;
const listen_address = config.puppeteer.host;

/**
 * The HTTP server
 * @type {{use: Function, get: Function, post: Function}}
 */
const app = express();
app.use(express.json()); // for parsing application/json

// The ugly globals
let server, browser;

// Our discovered environment
let marvin = {
    instance_type: "unknown",
    ipv4_addresses: [],
    ipv6_addresses: [],
    ipv4_gateway: "",
    ipv6_gateway: "",
    dns_servers: [],
    hostname: "",
};

// Processing counters
let activity = {
    browse: {
        completed: 0,
        failed: 0,
        rejected: 0,
        running: 0,
    },
    ping4: {
        completed: 0,
        failed: 0,
        rejected: 0,
        running: 0,
    },
    ping6: {
        completed: 0,
        failed: 0,
        rejected: 0,
        running: 0,
    },
    self_test: {
        completed: 0,
        failed: 0,
    },
};

app.post("/browse", async (request, response) => {
    // Check load limits
    if (activity.browse.running >= config.marvin.parallel_tasks) {
        activity.browse.rejected++;
        sendError(response, "We cannot accept more requests at this time", 429, activity.browse);
        return;
    }

    try {
        activity.browse.running++;
        const options = parseBrowseRequest(request);
        const result = await doBrowse(options, browser, marvin);
        activity.browse.completed++;
        response.json(Object.assign({success: true}, result));
    }
    catch (err) {
        activity.browse.failed++;
        sendException(response, err);
    }
    finally {
        activity.browse.running--;
    }
});

app.get("/info", async (request, response) => {
    try {
        const result = await getInfo(browser, marvin, config, activity);
        response.json(Object.assign({success: true}, result));
    }
    catch (err) {
        sendException(response, err);
    }
});

app.post("/ping4", async (request, response) => {
    try {
        activity.ping4.running++;
        const options = parsePingRequest(request.body);
        const result = await doPing(4, options);
        activity.ping4.completed++;
        response.json(Object.assign({success: true}, result));
    }
    catch (err) {
        activity.ping4.failed++;
        sendException(response, err);
    }
    finally {
        activity.ping4.running--;
    }
});

app.post("/ping6", async (request, response) => {
    try {
        activity.ping6.running++;
        const options = parsePingRequest(request);
        const result = await doPing(6, options);
        activity.ping6.completed++;
        response.json(Object.assign({success: true}, result));
    }
    catch (err) {
        activity.ping6.failed++;
        sendException(response, err);
    }
    finally {
        activity.ping6.failed++;
    }
});

app.get("/self-test", async (request, response) => {
    try {
        const result = await getSelfTest(browser, marvin, config);
        activity.self_test.completed++;
        response.json(Object.assign({success: true}, result));
    }
    catch (err) {
        activity.self_test.failed++;
        sendException(response, err);
    }
});

(async () => {
    browser = await Puppeteer.launch({
        args: config.puppeteer.args,
    });

    process.on("exit", function () {
        // Ensure that the browser process is stopped properly
        browser.close();
    });

    const interfaces = os.networkInterfaces();
    for (let if_name of Object.keys(interfaces)) {
        let if_addresses = interfaces[if_name];
        for (let if_address of if_addresses) {
            switch (if_address.family) {
                case "IPv4":
                    if (if_address.address.startsWith("127.")) {
                        continue;
                    }

                    // As long as docker doesn't do IPv6-only networks we use 255/8 as a dummy
                    if (if_address.address.startsWith("255.")) {
                        continue;
                    }

                    marvin.ipv4_addresses.push(if_address.address);
                    break;

                case "IPv6":
                    if (if_address.address === "::1") {
                        continue;
                    }

                    if (if_address.address.startsWith("fe80:")) {
                        continue;
                    }

                    marvin.ipv6_addresses.push(if_address.address);
                    break;
            }
        }
    }

    try {
        marvin.ipv4_gateway = defaultGateway.v4.sync().gateway;
    }
    catch (err) {
        marvin.ipv4_gateway = null;
    }
    try {
        marvin.ipv6_gateway = defaultGateway.v6.sync().gateway;
    }
    catch (err) {
        marvin.ipv6_gateway = null;
    }

    // noinspection JSUnresolvedFunction
    marvin.dns_servers = dns.getServers();
    marvin.hostname = os.hostname();

    const have_ipv4 = marvin.ipv4_addresses.length && marvin.ipv4_gateway;
    const have_ipv6 = marvin.ipv6_addresses.length && marvin.ipv6_gateway;

    try {
        // noinspection JSUnresolvedVariable
        await promisify(dns.resolve6)("ipv4only.arpa.");

        // Lookup successful: ipv4only has IPv6 addresses: DNS64
        console.log("ipv4only.arpa has IPv6 addresses: assuming NAT64");
        if (have_ipv4 || !have_ipv6) {
            console.error("We should have IPv6-only connectivity when in NAT64 mode");
            process.exit(1);
        }
        marvin.instance_type = "nat64";
    }
    catch (err) {
        // Lookup not successful: no DNS64
        if (have_ipv4 && have_ipv6) {
            console.log("Both IPv4 and IPv6 detected, running dual-stack");
            marvin.instance_type = "dual-stack";
        } else if (have_ipv4) {
            console.log("Only IPv4 detected, running v4-only");
            marvin.instance_type = "v4-only";
        } else if (have_ipv4) {
            console.log("Only IPv6 detected, running v6-only");
            marvin.instance_type = "v6-only";
        } else {
            console.error("Neither IPv4 nor IPv6 detected, unable to continue");
            process.exit(1);
        }
    }

    server = await app.listen(port, listen_address);
    console.log("Puppeteer listening on", listen_address, "port", port);

    process.on("SIGINT", async () => {
        console.log("Caught interrupt signal, finishing running tests");
        await server.close();
        console.log("Exiting after catching interrupt signal")
    });

    process.on("SIGTERM", async () => {
        console.log("Caught termination signal, finishing running tests");
        await server.close();
        console.log("Exiting after catching termination signal")
    });
})();
