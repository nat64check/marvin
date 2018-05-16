const Puppeteer = require("puppeteer");
const express = require("express");
const os = require("os");
const dns = require("dns");
const defaultGateway = require("default-gateway");
const {promisify} = require('util');

const {getInfo} = require("./handlers/info");
const {postRequest} = require("./handlers/request");
const {getSelfTest} = require("./handlers/self_test");

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
    ipv4_gateway: '',
    ipv6_gateway: '',
    dns_servers: [],
    hostname: '',
};

// Processing counters
let activity = {
    completed_tasks: 0,
    failed_tasks: 0,
    rejected_tasks: 0,
    running_tasks: 0,
};

app.post("/request", async (request, response) => {
    await postRequest(request, response, browser, marvin, config, activity);
});

app.get("/info", async (request, response) => {
    await getInfo(request, response, browser, marvin, config, activity);
});

app.get("/self-test", async (request, response) => {
    await getSelfTest(request, response, browser, marvin, config);
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
                    if (if_address.address.startsWith("127."))
                        continue;

                    marvin.ipv4_addresses.push(if_address.address);
                    break;

                case "IPv6":
                    if (if_address.address === "::1")
                        continue;

                    if (if_address.address.startsWith("fe80:"))
                        continue;

                    marvin.ipv6_addresses.push(if_address.address);
                    break;
            }
        }
    }

    try {
        marvin.ipv4_gateway = defaultGateway.v4.sync().gateway;
    } catch (err) {
        marvin.ipv4_gateway = null;
    }
    try {
        marvin.ipv6_gateway = defaultGateway.v6.sync().gateway;
    } catch (err) {
        marvin.ipv6_gateway = null;
    }

    // noinspection JSUnresolvedFunction
    marvin.dns_servers = dns.getServers();
    marvin.hostname = os.hostname();

    const have_ipv4 = marvin.ipv4_addresses && marvin.ipv4_gateway;
    const have_ipv6 = marvin.ipv6_addresses && marvin.ipv6_gateway;

    try {
        // noinspection JSUnresolvedFunction
        await promisify(dns.resolve6)("ipv4only.arpa.");

        // Lookup successful: ipv4only has IPv6 addresses: DNS64
        console.log("ipv4only.arpa has IPv6 addresses: assuming NAT64");
        if (have_ipv4 || !have_ipv6) {
            console.error("We should have IPv6-only connectivity when in NAT64 mode");
            process.exit(1);
        }
        marvin.instance_type = "nat64";
    } catch (err) {
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

    process.on('SIGINT', async () => {
        console.log("Caught interrupt signal, finishing running tests");
        await server.close();
        console.log("Exiting after catching interrupt signal")
    });

    process.on('SIGTERM', async () => {
        console.log("Caught termination signal, finishing running tests");
        await server.close();
        console.log("Exiting after catching termination signal")
    });
})();
