'use strict';

const _                 = require('lodash');
const axios             = require('axios');

const AbstractEvsApiClient  = require('./abstract-evs-api-client');
const NCITConcept           = require('./ncit-concept');
const EvsNotFoundException  = require('./evs-not-found-exception');
const EvsServerException    = require('./evs-server-exception');


/**
 * Concrete implementation of the EVS API client
 */
class EvsApiClient extends AbstractEvsApiClient {

    /**
     * 
     * @param {*} server The server name of the API 
     * @param {*} protocol The protocol to use
     * @param {*} port The port of the API
     */
    constructor(logger, server, protocol, port) {
        super();

        this.server = server;
        this.port = port;
        this.protocol = protocol;

        this.termCache = {};
        this.fetchList = [];
        this.fetchErrors = [];
    }

    /**
     * Internal method that fetches item from svc
     * @param {*} termID 
     */
    async _getConceptFromSVC(termID) {
        let server_port = this.server;
        if (this.port) {
            server_port += `:${this.port}`
        }
        let url = `${this.protocol}://${server_port}/evsrestapi/api/v1/ctrp/concept/${termID}/`;

        try {
            let response = await axios.get(url, {
                response: 'json'
            });

            console.log(response);
            console.log(response.data);

        } catch (err) {
            //We need to figure out what is going on.
            if (err.response.status == 404) {
                throw new EvsNotFoundException("Term was not found");
            } else {
                throw new EvsServerException(err.response.data.error);
            }
        }
    }

    /**
     * Maps response object to an instance of a NCITConcept
     * @param {*} data 
     */
    _mapSvcResponseToConcept(data) {

    }

    /**
     * Gets a concept from a EVS API
     * @param {*} termID The concept id
     * @returns Resolves to a NCITConcept
     */
    async getConcept(termID) {
        //Check the cache to see if we have this item
        if (this.termCache[termID]) {
            return this.termCache[termID];
        }

        //There was an error with the fetch, rethrow it like it just happened.
        if (this.fetchErrors[termID]) {
            throw this.fetchErrors[termID]
        }

        //Ok, so we don't need to cache, are we fetching it now?
        if (!this.fetchList.includes(termID)) {
            try {
                //Add this to the list of items being fetched
                this.fetchList.push(termID);
                //Get it
                let concept = await this._getConceptFromSVC(termID);
                //Add it to the cache
                this.termCache[termID] = concept;
            } catch (err) {
                //There was an error, add it to the list so we don't try and refresh
                this.fetchErrors[termID] = err; 
                throw err; //Let's rethrow it so that other can capture it.
            } finally {
                //Whatever the result, remove the item
                _.pull(this.fetchList, termID);
            }

            //If we got here, we exist.
            return this.termCache[termID];
        } else {
            //Wait until the item has been fetched.
            //await this._waitUntilFetched(termID);

            //if (this.fetchErrors.includes(termID)) {

            //}
        }
    }

    /**
     * Waits until an item has been fetched.
     * @param {*} termID 
     */
    async _waitUntilFetched(termID) {
        return;
    }


}

module.exports = EvsApiClient;