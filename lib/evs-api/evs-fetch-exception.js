'use strict';

/**
 * Base class for EvsFetchExceptions
 */
class EvsFetchException extends Error {

    constructor(...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);
    
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, EvsFetchException);
        }    
    }
}

module.exports = EvsFetchException;