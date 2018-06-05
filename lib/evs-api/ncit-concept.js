'use strict';

const _                 = require('lodash');

const NCITConceptLink       = require('./ncit-concept-link');
const NCITSynonym           = require('./ncit-synonym');

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
        this.code = code;
        this.label = label;
        this.displayName = displayName;
        this.preferredName = preferredName;
        this.isDiseaseStage = isDiseaseStage;
        this.isDiseaseGrade = isDiseaseGrade;
        this.isMainType = isMainType;
        this.isSubtype = isSubtype;
        this.isDisease = isDisease;

        this.superConcepts = [];
        this.subConcepts = [];
        this.synonyms = [];
        this.semanticTypes = [];
        this.additionalProperties = []; //For future if needed.
    }

    /**
     * Gets a collection of synonyms filtered by source and type, source or type.
     * @param {*} source 
     * @param {*} type 
     */
    getFilteredSynonyms(source, type) {

        if (source && type) {
            return _.filter(this.synonyms, syn => {
                return syn.source == source && syn.group;
            })
        } else if (source) {
            return _.filter(this.synonyms, syn => {
                return syn.source == source;
            })
        } else if (type) {
            return _.filter(this.synonyms, syn => {
                return syn.group;
            })
        } else {
            return this.synonyms;
        }
    }

    /**
     * Creates a NCI Thesaurus Concept instance from JSON
     * @param {*} data 
     */
    static fromJSON(data) {
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
}

module.exports = NCITConcept;