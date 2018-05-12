/**
 *
 * @param {object}   request                        HTTP request
 * @param {object}   response                       HTTP response
 * @param {object}   server                         HTTP server
 *
 * @returns {Promise<void>}
 */
async function postDie(request, response, server) {
    console.log("Requested to die");

    response.send("Bye bye");
    await server.close();
    process.exit(0);
}

module.exports = postDie;
