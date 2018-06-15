"use strict";

const my_package = require("../package");

/**
 * Show information about this Marvin
 *
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
 * @param {object}   activity                              Activity counters
 *
 * @returns {Promise<object>}
 */
async function getInfo(browser, marvin, config, activity) {
    console.log("Showing info");

    const browser_version = await browser.version();

    return {
        type: "Puppeteer",
        version: my_package.version.split('.').map(i => parseInt(i, 10)),
        browser: {
            name: browser_version.split("/")[0],
            version: browser_version.split("/")[1].split("."),
        },
        instance_type: marvin.instance_type,
        name: marvin.hostname,
        network: {
            ipv4: {
                addresses: marvin.ipv4_addresses,
                gateway: marvin.ipv4_gateway,
            },
            ipv6: {
                addresses: marvin.ipv6_addresses,
                gateway: marvin.ipv6_gateway,
            },
            dns_servers: marvin.dns_servers,
        },
        limits: {
            parallel_tasks: config.marvin.parallel_tasks,
        },
        activity,
    };
}

module.exports = {
    getInfo,
};
