'use strict';

const _                 = require('lodash');
const axios             = require('axios');
const http              = require('http');
const https             = require('https');
const util              = require('util');

const setTimeoutPromise = util.promisify(setTimeout);

const AbstractEvsApiClient  = require('./abstract-evs-api-client');
const NCITConcept           = require('./ncit-concept');
const NCITConceptLink       = require('./ncit-concept-link');
const NCITSynonym           = require('./ncit-synonym');
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

        //TODO: These should be passed in so we can create mocks.
        this.httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
        this.httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
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
                httpsAgent: this.httpsAgent, //Use the same agent to manage the number of concurrent requests.
                response: 'json'
            });

            return this._mapSvcResponseToConcept(response.data);
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
        
        //Create concept
        let rtnConcept = new NCITConcept(
            data.code,
            data.label,
            data.displayName,
            data.preferredName,
            data.isDiseaseStage, 
            data.isDiseaseGrade, 
            data.isMainType, 
            data.isSubtype, 
            data.isDisease
        );

        if (data.semanticTypes.length > 0) {
            data.semanticTypes.forEach(element => {
                rtnConcept.semanticTypes.push(element);
            });
        }

        if (data.subconcepts.length > 0) {
            data.subconcepts.forEach(concept => {
                rtnConcept.subConcepts.push(new NCITConceptLink(concept.code, concept.label));
            })
        }

        if (data.superconcepts.length > 0) {
            data.superconcepts.forEach(concept => {
                rtnConcept.superConcepts.push(new NCITConceptLink(concept.code, concept.label));
            })
        }

        if (data.synonyms.length > 0) {
            data.synonyms.forEach(syn => {
                rtnConcept.synonyms.push(new NCITSynonym(syn.termName, syn.termGroup, syn.termSource, syn.sourceCode, syn.subsourceName));
            });
        }

        return rtnConcept;
    }

    /**
     * Gets a concept from a EVS API
     * @param {*} termID The concept id
     * @returns Resolves to a NCITConcept
     */
    async getConcept(termID) {
        
        if (!this.termCache[termID] && !this.fetchErrors[termID] && !this.fetchList.includes(termID)) {
            //So if we have never attempted or are attempting to fetch this item, go ahead and fetch it.

            try {
                //Add this to the list of items being fetched
                this.fetchList.push(termID);
                //Get it
                let concept = await this._getConceptFromSVC(termID);                
                //Add it to the cache
                this.termCache[termID] = concept;
            } catch (err) {
                //There was an error, add it to the list so we don't try and reload
                //the bad item
                this.fetchErrors[termID] = err; 
            } finally {
                //Whatever the result, remove the item from the pending list
                _.pull(this.fetchList, termID);
            }            
        } else if (this.fetchList.includes(termID)) {
            // We are currently in the process of fetching the item
            // We need to block until it happens
            await this._waitUntilFetched(termID);
        }

        //Check the cache to see if we have this item
        if (this.termCache[termID]) {
            return this.termCache[termID];
        }

        //There was an error with the fetch, rethrow it like it just happened.
        if (this.fetchErrors[termID]) {
            throw this.fetchErrors[termID]
        }
    }

    /**
     * Waits until an item has been fetched.
     * @param {*} termID 
     */
    async _waitUntilFetched(termID) {
        let self = this;

        return new Promise((resolve, reject) => {
            var check = () => {
                if (!self.fetchList.includes(termID)) {
                    //This ID is no longer being fetched, so we can resolve
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            }
            setTimeout(check, 100);
        })
    }


}

module.exports = EvsApiClient;