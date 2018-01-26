'use strict';

const EvsFetchException  = require('./evs-fetch-exception');

/**
 * Class representing an issue retreiving a term
 */
class EvsNotFoundException extends EvsFetchException {

    constructor(...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);
    
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, EvsNotFoundException);
        }    
    }
}

module.exports = EvsNotFoundException;