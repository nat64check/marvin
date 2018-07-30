"use strict";

const {doBrowse} = require("./browse");
const PNG = require('pngjs').PNG;
const {ServerError} = require("../utils");

const ds = "ff0000ff";
const v4 = "00ff00ff";
const v6 = "0000ffff";
const v4_lit = "ffff00ff";
const v6_lit = "ff00ffff";
const fail = "ffffffff";

/**
 *
 * @param {string} image
 * @returns {Promise<Buffer>}
 */
async function parseBase64Image(image) {
    let buf = Buffer.from(image, 'base64');

    return new Promise(function (resolve, reject) {
        new PNG()
            .parse(buf)
            .on('parsed', resolve)
            .on('error', reject)
    });
}

/**
 *
 * @param {object}   browser                        Chromium browser
 *
 * @param {object}   marvin                         Marvin environment
 * @param {string}   marvin.instance_type           Marvin instance type
 *
 * @returns {Promise<object>}
 */
async function getSelfTest(browser, marvin) {
    // Construct the options
    const options = {
        url: "http://check.core.nat64check.org/self-test/",
        timeout: 10,
        viewport: {
            width: 3,
            height: 2,
        },
        silent: true,
    };

    // Construct what we want to receive
    const have_v4 = (marvin.instance_type !== 'v6only');
    const have_v4_lit = (marvin.instance_type !== 'v6only' && marvin.instance_type !== 'nat64');
    const have_v6 = (marvin.instance_type !== 'v4only');

    const line1 = ds + (have_v4 ? v4 : fail) + (have_v6 ? v6 : fail);
    const line2 = ds + (have_v4_lit ? v4_lit : fail) + (have_v6 ? v6_lit : fail);
    const wanted_hex = line1 + line2;

    // Perform the request
    let result = await doBrowse(options, browser, marvin, null);
    if (!result.success) {
        throw new ServerError("Self-test failed, could not retrieve test page");
    }

    // And let's see if we get want we expect
    let image = await parseBase64Image(result.image);
    let page_hex = image.toString('hex');

    if (page_hex === wanted_hex) {
        return {
            message: "Self-test completed successfully",
        };
    } else {
        throw new ServerError("Self-test failed, images do not match");
    }
}

module.exports = {
    getSelfTest,
};
