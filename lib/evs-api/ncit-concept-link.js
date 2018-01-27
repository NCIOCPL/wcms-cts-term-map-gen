'use strict';

/**
 * Represents a link to another NCI Thesaurus concept
 */
class NCITConceptLink {

    /**
     * Creates a new instance of a NCIT Concept Link
     * @param {*} code The NCIT code
     * @param {*} label The label of the concept
     */
    constructor(code, label) {
        this.code = code;
        this.label = label;
    }
}

module.exports = NCITConceptLink;