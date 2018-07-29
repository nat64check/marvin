"use strict";

const moment = require("moment");
const http = require("http");
const {ClientError, ServerError} = require("../utils");

async function getBrowserPage(resources, messages, context, pageStart) {
    const page = await context.newPage();

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
        if (request.url().startsWith("data:") || request.url().startsWith("blank:")) {
            return;
        }

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
        if (response.url().startsWith("data:") || response.url().startsWith("blank:")) {
            return;
        }

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

function parseBrowseRequest(request) {
    let options = {};

    // Parse input
    try {
        options.url = String(request.body.url || "").trim();
        options.timeout = Number(request.body.timeout) || 60;
        options.viewport = {
            width: Number(request.body.viewport && request.body.viewport[0]) || 1024,
            height: Number(request.body.viewport && request.body.viewport[1]) || 1024,
        };
    }
    catch (err) {
        throw new ClientError("Error parsing browse request", err);
    }

    // Sanity check
    if (!options.url) {
        throw new ClientError("url is a required request parameter", options);
    }
    if (options.timeout < 5 || options.timeout > 300) {
        throw new ClientError("timeout must be between 5 and 300", options);
    }
    if (options.viewport.width < 256 || options.viewport.width > 5000) {
        throw new ClientError("viewport width must be between 256 and 5000", options);
    }
    if (options.viewport.height < 256 || options.viewport.height > 5000) {
        throw new ClientError("viewport height must be between 256 and 5000", options);
    }

    return options;
}

/**
 *
 * @param {object}          options                 Requested options
 * @param {object}          browser                 Chromium browser
 *
 * @param {object}          marvin                  Marvin environment
 * @param {string}          marvin.instance_type    Marvin instance type
 * @param {string}          marvin.hostname         Hostname of this Marvin
 *
 * @param {MarvinStatus|EventEmitter}    status                  Event channel for status updates
 *
 * @returns {Promise<object>}
 */
async function doBrowse(options, browser, marvin, status) {
    // Perform request
    let context, page, result, duration, errorSeen;

    const onError = (reason) => {
        errorSeen = reason;
    };

    try {
        let resources = [];
        let messages = [];
        const start = moment();

        // Monitor for errors while browsing
        status.on('error', onError);
        errorSeen = status.last_error;

        if (errorSeen) {
            throw new ServerError("experiencing some problems, please try again later", errorSeen, 503);
        }

        context = await browser.createIncognitoBrowserContext();
        page = await getBrowserPage(resources, messages, context, start);
        await page.setViewport(options.viewport);
        page.setDefaultNavigationTimeout(options.timeout * 1000);

        console.log("Testing", options.url);

        try {
            result = await page.goto(options.url);
            duration = (moment() - start) / 1000;
        }
        catch (err) {
            if (errorSeen) {
                throw new ServerError("dubious connectivity during test, please try again later", errorSeen, 503);
            }

            if (err.message.includes("ERR_NAME_NOT_RESOLVED")) {
                throw new ClientError("invalid hostname", err, 400);
            } else {
                throw err;
            }
        }

        if (errorSeen) {
            throw new ServerError("dubious connectivity during test, please try again later", errorSeen, 503);
        }

        if (!result.ok()) {
            const status = result.status();
            throw new ClientError((http.STATUS_CODES[status] || "Unknown error") + " (" + status + ") error while retrieving URL", status);
        }

        // Wait one extra second before taking that screenshot, some pages are annoyingly dynamic
        await new Promise(res => setTimeout(res, 1000));
        const screenshot = Buffer.from(await page.screenshot({
            type: "png",
            omitBackground: false,
        })).toString("base64");

        return {
            test: {
                type: marvin.instance_type,
                host: marvin.hostname,
            },
            request: options,
            start: start.toISOString(),
            duration: duration,
            console: messages,
            resources: resources,
            image: screenshot,
        };
    }
    finally {
        if (context) {
            context.close();
        }

        // Stop listening to status
        status.removeListener('error', onError);
    }
}

module.exports = {
    parseBrowseRequest,
    doBrowse,
};
