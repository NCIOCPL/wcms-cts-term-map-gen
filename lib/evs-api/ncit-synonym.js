'use strict';

/**
 * Represents a synonym for a NCI Thesaurus concept
 */
class NCITSynonym {

    /**
     * Creates a new instance of a NCI Thesaurus synonym
     */
    constructor(termName, termGroup, termSource, sourceCode, subsourceName) {
        this.name = termName;
        this.group = termGroup;
        this.source = termSource;
        this.sourceCode = sourceCode;
        this.subsourceName = subsourceName;
    }
}

module.exports = NCITSynonym;