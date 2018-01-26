'use strict';

const EvsFetchException  = require('./evs-fetch-exception');

/**
 * Represents an EVS server error.
 */
class EvsServerException extends EvsFetchException {

    constructor(...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);
    
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, EvsServerException);
        }    
    }
}

module.exports = EvsServerException;