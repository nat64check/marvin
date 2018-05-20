const moment = require("moment");
const sendError = require("../utils/send_error");

async function getBrowserPage(resources, messages, browser, pageStart) {
    const page = await browser.newPage();

    page.on("dialog", async dialog => {
        await dialog.dismiss();
    });

    page.on("console", msg => {
        messages.push({
            type: msg.type(),
            message: msg.text(),
        });
    });

    page.on("pageerror", error => {
        messages.push({
            type: "error",
            message: error.message.replace(/\s+/g, " "),
        });
    });

    page.on("request", request => {
        request._start = (moment() - pageStart) / 1000;
    });

    page.on("requestfailed", request => {
        // These are not interesting
        if (request.url().startsWith("data:") || request.url().startsWith("blank:"))
            return;

        const resourceObject = {
            success: false,
            request: {
                method: request.method(),
                url: request.url(),
                headers: request.headers(),
                resource_type: request.resourceType(),
                redirect_chain: request.redirectChain().map(request => ({
                    from: request.url(),
                    to: request.response().headers().location || "",
                    status: request.response().status(),
                })),
                time: request._start,
            },
            response: {
                failure: request.failure().errorText,
                time: (moment() - pageStart) / 1000,
            },
        };
        resources.push(resourceObject);
    });

    page.on("requestfinished", request => {
        const response = request.response();

        // These are not interesting
        if (response.url().startsWith("data:") || response.url().startsWith("blank:"))
            return;

        const status = response.status();
        const resourceObject = {
            success: 200 <= status && status <= 399,
            request: {
                method: request.method(),
                url: request.url(),
                headers: request.headers(),
                resource_type: request.resourceType(),
                redirect_chain: request.redirectChain().map(request => ({
                    from: request.url(),
                    to: request.response().headers().location || "",
                    status: request.response().status(),
                })).slice(0, (300 <= status && status <= 399) ? -1 : undefined),
                time: request._start,
            },
            response: {
                status: status,
                headers: response.headers(),
                time: (moment() - pageStart) / 1000,
            },
        };
        resources.push(resourceObject);
    });

    await page.setCacheEnabled(false);
    await page.evaluateOnNewDocument(() => {
        window.open = () => null;
    });

    return page;
}

/**
 *
 * @param {object}   request                        HTTP request
 * @param {object}   response                       HTTP response
 * @param {object}   browser                        Chromium browser
 *
 * @param {object}   marvin                         Marvin environment
 * @param {string}   marvin.instance_type           Marvin instance type
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
async function postBrowse(request, response, browser, marvin, config, activity) {
    try {
        let url, pageTimeout, viewport;

        // Parse input
        try {
            url = String(request.body.url).trim();
            pageTimeout = Number(request.body.timeout) || 60;
            viewport = {
                width: Number(request.body.viewport && request.body.viewport[0]) || 1024,
                height: Number(request.body.viewport && request.body.viewport[1]) || 1024,
            };
        }
        catch (err) {
            activity.failed_tasks++;
            return sendError(response, "Error parsing request", 400);
        }

        // Sanity check
        if (!url) {
            activity.failed_tasks++;
            return sendError(response, "url is a required request parameter", 400);
        }

        // Check load limits
        if (activity.running_tasks >= config.marvin.parallel_tasks) {
            activity.rejected_tasks++;
            return sendError(response, "We cannot accept more requests at this time", 429);
        }

        // Update stats
        activity.running_tasks++;

        // Perform request
        try {
            let resources = [];
            let messages = [];
            const start = moment();

            let page = await getBrowserPage(resources, messages, browser, start);
            await page.setViewport(viewport);

            console.log("Testing", url);

            await page.goto(url);
            const duration = (moment() - start) / 1000;

            const screenshot = Buffer.from(await page.screenshot({
                type: "png",
                omitBackground: false,
            })).toString("base64");

            response.json({
                test: {
                    type: marvin.instance_type,
                    host: marvin.hostname,
                },
                request: {
                    url: url,
                    viewport: [viewport.width, viewport.height],
                    timeout: pageTimeout,
                },
                success: true,
                reason: "Request completed successfully",
                start: start.toISOString(),
                duration: duration,
                console: messages,
                resources: resources,
                image: screenshot,
            });

            activity.completed_tasks++;

            page.close();
        }
        catch (err) {
            activity.failed_tasks++;
            if (err.message.includes("ERR_NAME_NOT_RESOLVED")) {
                return sendError(response, "invalid hostname", 400, err);
            } else {
                return sendError(response, "unexpected error while processing request", 500, err);
            }
        }
    } finally {
        // Make sure we remember that we are done
        activity.running_tasks--;
    }
}

module.exports = {
    postBrowse
};
