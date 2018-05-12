const sendError = require("../utils/send_error");

/**
 *
 * @param {object}   request                        HTTP request
 * @param {object}   response                       HTTP response
 * @param {object}   browser                        Chromium browser
 *
 * @param {object}   marvin                         Marvin environment
 * @param {string}   marvin.instance_type           Marvin instance type
 * @param {string[]} marvin.ipv4_addresses          Marvin's IPv4 addresses
 * @param {string[]} marvin.ipv6_addresses          Marvin's IPv6 addresses
 * @param {string}   marvin.ipv4_gateway            Marvin's IPv4 default gateway
 * @param {string}   marvin.ipv6_gateway            Marvin's IPv6 default gateway
 * @param {string[]} marvin.dns_servers             Marvin's DNS servers
 * @param {string}   marvin.hostname                Hostname of this Marvin

 * @param {object}   config                         Application configuration
 * @param {object}   config.marvin                  Configuration for Marvin
 * @param {number}   config.marvin.parallel_tasks   Limit on parallel requests
 *
 * @returns {Promise<void>}
 */
async function getSelfTest(request, response, browser, marvin, config) {
    console.log("Running self-test");

    try {
        response.send("No checks yet");
    } catch (err) {
        sendError(response, "Unexpected error", 500, err);
    }
}

module.exports = getSelfTest;
