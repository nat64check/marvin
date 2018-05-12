const sendError = require("../utils/send_error");

/**
 * Show information about this Marvin
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
 * @param {object}   activity                       Activity counters
 * @param {number}   activity.completed_tasks       Number of tasks completed
 * @param {number}   activity.failed_tasks          Number of failed tasks
 * @param {number}   activity.rejected_tasks        Number of rejected tasks
 * @param {number}   activity.running_tasks         Number of tasks currently running (used for rejecting new tasks)
 *
 * @returns {Promise<void>}
 */
async function getInfo(request, response, browser, marvin, config, activity) {
    console.log("Showing info");

    try {
        const browser_version = await browser.version();

        response.json({
            type: "Puppeteer",
            version: [0, 2, 0],
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
        });
    } catch (err) {
        sendError(response, "unexpected error while getting configuration", 500, err);
    }
}

module.exports = getInfo;
