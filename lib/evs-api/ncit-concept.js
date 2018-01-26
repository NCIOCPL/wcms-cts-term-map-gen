'use strict';

/**
 * This class represents a thesaurus concept as returned by the EVSAPI
 */
class NCITConcept {

    /**
     * Creates a new instance of a NCI Thesaurus Concept
     * @param {*} code The NCI Thesaurus Code
     * @param {*} label The NCI Thesaurus Raw Label
     * @param {*} displayName The common name for displaying
     * @param {*} preferredName The preferred scientific name
     * @param {*} isDiseaseStage Is this a disease stage?
     * @param {*} isDiseaseGrade Is this a disease grade? 
     * @param {*} isMainType Is this a maintype for menuing purposes? 
     * @param {*} isSubtype Is this a subtype for menuing purposes? 
     * @param {*} isDisease Is this a disease? 
     */
    constructor(
        code, label, displayName, preferredName, 
        isDiseaseStage, isDiseaseGrade, isMainType, isSubtype,
        isDisease
    ) {
        this.superconcepts = [];
        this.subconcepts = [];
        this.synonyms = [];
        this.semanticTypes = [];
        this.additionalProperties
    }
}

module.exports = NCITConcept;