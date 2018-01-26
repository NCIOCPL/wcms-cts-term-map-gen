'use strict';

/**
 * This class represents a abstract class for all EVS API clients.
 */
class AbstractEvsApiClient {

    /**
     * Base constructor for an AbstractEvsApiClient implementation
     */
    constructor() {
        if (this.constructor === AbstractEvsApiClient) {
            throw new TypeError("Cannot construct AbstractEvsApiClient");
        }

        if (this.getConcept === AbstractEvsApiClient.prototype.getConcept) {
            throw new TypeError("Must implement abstract method getConcept");
        }
    }

    /**
     * Gets a concept from a EVS API
     * @param {*} termID The concept id
     * @returns Resolves to a NCITConcept
     */
    async getConcept(termID) {
        throw new TypeError("Cannot call abstract method getConcept from derrived class");
    }

}

module.exports = AbstractEvsApiClient;