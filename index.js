/**************************
*
* The following is a script that may be used to extract EVS terminology
* from the EVSAPI to be used by dynamic listing pages.  The logic loosely
* mirrors the logic in the CTSAPI enrichment process
*
***************************/
 
'use strict';
const _                 = require('lodash');
const fs                = require('fs');
const config            = require('config');
const diacritics        = require('diacritics');
const util              = require('util');
const winston           = require('winston');
 
const EvsApiClient      = require('./lib/evs-api/evs-api-client');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console()
    ]
})

const validUrlRegex = /^[a-z0-9\-]+$/;

let server = 'evsrestapi.nci.nih.gov'; 

let client = new EvsApiClient(logger, server, 'https');

const MAX_URL_LEN = 75;
 
async function fetchTermAndChildren(termID) {
 
    let concepts = [];

    let concept = await client.getConcept(termID);
    concepts.push(concept);

    let subConcepts = await Promise.all(
        concept.subConcepts.map(async (subLink) => {
            let subConceptAndChildren = await fetchTermAndChildren(subLink.code);
            //So a little under the hood information.  We cache concepts, so
            //if two concepts have the same code, they must be the same instance.
            //So we can use a normal comparer for the union command.
            concepts = _.union(concepts, subConceptAndChildren);
        })
    )

    return concepts;

}
 
/**
 * Gets a friendly URL string based on a display name
 * @param {*} displayName 
 */
function getFriendlyUrlForDisplayName(displayName) {
    let url = displayName;
        url = url.replace('Ã¶', 'ö') //Hacks for API encoding issues
                .replace('Ã³', 'ó') 
        url = diacritics.remove(url)
            .toLowerCase()
            .replace(/[",+()./'[:*\]]+/g, "")
            .replace(/(\s+|[;_&])/g, "-")
            .replace(/[%]+/g,'pct');
    //Replace non-latin characters (e.g. greek) with latin equivelents. n
 
    return url;
}

/**
 * 
 * @param {*} allTerms 
 */
function rollupConceptsToMappings(allTerms) {

    let allMappings = {};

    //Now we iterate over the disease list
    //this is NOT a mapping function because we want to
    //merge all the codes for the same display name,
    //so 5 concepts may end up being one mapping if they
    //have the same name.
    for (let i=0; i < allTerms.length; i++) {
        //Figure out pretty name
        let cncpt = allTerms[i];
    
        //Fallback to preferred name
        let displayName = cncpt.preferredName;
    
        //does the term have a display name? use that
        if (cncpt.displayName) {
            displayName = cncpt.displayName;
        }
    
        //does the term have a CTRP DN? use that
        let ctrpDN = cncpt.getFilteredSynonyms('CTRP', 'DN');
        if (ctrpDN.length > 0) {
            displayName = ctrpDN[0].name;
        }
    
        //Using lowercase display name because of a few data issues
        //however, IIIB vs IIIb should not matter.
        if (!allMappings[displayName.toLowerCase()]) {
            allMappings[displayName.toLowerCase()] = {
                displayName: displayName,
                codes: [],
                isMenuItem: ( cncpt.isDisease && (cncpt.isMainType || cncpt.isSubtype)) || cncpt.isDiseaseStage,
                friendlyUrl: getFriendlyUrlForDisplayName(displayName)
            };
        }
            
        allMappings[displayName.toLowerCase()].codes.push(cncpt.code);
    } 
    
    return allMappings;
}

function validateMappings(allMappings) {

    let hasErrors = false;
    let urls = {};

    //We know all display names are unique because we are a dictionary
    //lets make sure that:
    //  1) All URLs would be unique
    //  2) All URLs match a-z0-9\-
    _.forEach(allMappings, (mapping) => {        
        if (Object.keys(urls).includes(mapping.friendlyUrl)) {
            hasErrors = true;
            logger.error(`Validation Error: Duplicate URL ${mapping.friendlyUrl}: Codes: ${urls[mapping.friendlyUrl].codes} -- ${mapping.codes} `)
        } else {
            urls[mapping.friendlyUrl] = mapping;
        }

        if (!validUrlRegex.test(mapping.friendlyUrl)) {
            hasErrors = true;
            logger.error(`Validation Error: URL Contains invalid chars ${mapping.friendlyUrl}`)
        }
    })

    return !hasErrors;
}

/**
 * Outputs all mappings to 
 * @param {*} allMappings 
 * @param {*} formatter Function(item) : string A formatter function to modify a mapping to the correct output.
 */
function outputMappingFile(allMappings, filePath, formatter) {
    return new Promise((resolve, reject) => {
        let mapStream = null;

        try {
            mapStream = fs.createWriteStream(filePath)           
                .on('error', reject)
                .on('finish', resolve);
        } catch(err) {
            return reject(err);
        }

        _.forEach(allMappings, (mapping) => {
            mapStream.write(formatter.call(null, mapping));
            mapStream.write("\n"); //Write newline
        })

        mapStream.end();
    });
}


async function diseaseMappings() {

    //TODO: Make these config settings

    // Root disease, disorder or finding
    let rootConceptID = 'C7057';

    // Disease or Disorder (no findings/side effects/biomarkers)
    //let rootConceptID = 'C2991';

    //Breast Cancer
    //let rootConceptID = 'C4872';

    logger.info("Fetching Disease Terms")
    //Fetch all EVS diseases
    let allDiseases = await fetchTermAndChildren(rootConceptID);
    logger.info(`Fetched ${allDiseases.length} disease terms`);    

    //Remove these bad terms
    let badDiseases = [ 'C138195', 'C131913' ];
    _.remove(allDiseases, (disease) => { return badDiseases.includes(disease.code); });

    logger.info("Rolling Up disease Mappings")
    //Roll up the codes to a single mapping
    let allMappings = rollupConceptsToMappings(allDiseases); 
    logger.info(`Rolled up ${Object.keys(allMappings).length} disease mappings`);
     
    let tooLongURLs = [];

    let mappingsForUrls = _.pickBy(allMappings, (mapping) => {
        if (!mapping.isMenuItem) {
            return false;
        }

        if (mapping.friendlyUrl.length > MAX_URL_LEN) {
            tooLongURLs.push({
                friendlyUrl: mapping.friendlyUrl,
                codes: mapping.codes
            });
            return false;
        }

        return true;
    });

    if (validateMappings(mappingsForUrls)) {
        logger.info(`All disease mappings are valid - outputting. Names: ${Object.keys(allMappings).length} URLS: ${Object.keys(mappingsForUrls).length}`)

        await outputMappingFile(allMappings, './disease-name-mappings.txt', (mapEntry) => {
            let codes = mapEntry.codes.join(',');
            return `${codes}|${mapEntry.displayName}`
        });

        await outputMappingFile(mappingsForUrls, './disease-url-mappings.txt', (mapEntry) => {
            let codes = mapEntry.codes.join(',');
            return `${codes}|${mapEntry.friendlyUrl}`
        });

        await outputMappingFile(tooLongURLs, './disease-url-toolong.txt', (mapEntry) => {
            let codes = mapEntry.codes.join(',');
            return `${codes}|${mapEntry.friendlyUrl}`
        });

    } else {
        logger.error("Invalid disease Mappings Found")
    }

}

async function interventionMappings() {    

    //TODO: Make these config settings
    
    // Root drugs
    let rootConceptID = 'C1908';

    logger.info("Fetching Intervention Terms")
    //Fetch all EVS diseases
    let allInterventions = await fetchTermAndChildren(rootConceptID);
    logger.info(`Fetched ${allInterventions.length} intervention terms`);

    //Remove these bad terms
    let badInterventions = [  ];
    _.remove(allInterventions, (intervention) => { return badInterventions.includes(intervention.code); });

    logger.info("Rolling Up intervention Mappings")
    //Roll up the codes to a single mapping
    let allMappings = rollupConceptsToMappings(allInterventions); 
    logger.info(`Rolled up ${Object.keys(allMappings).length} intervention mappings`);

    let tooLongURLs = [];

    let mappingsForUrls = _.pickBy(allMappings, (mapping) => {

        if (mapping.friendlyUrl.length > MAX_URL_LEN) {
            tooLongURLs.push({
                friendlyUrl: mapping.friendlyUrl,
                codes: mapping.codes
            });
            return false;
        }

        return true;
    });

    if (validateMappings(mappingsForUrls)) {

        logger.info(`All intervention mappings are valid - outputting. Names: ${Object.keys(allMappings).length}  URLS: ${Object.keys(mappingsForUrls).length}`)

        await outputMappingFile(allMappings, './intervention-name-mappings.txt', (mapEntry) => {
            let codes = mapEntry.codes.join(',');
            return `${codes}|${mapEntry.displayName}`
        });

        await outputMappingFile(mappingsForUrls, './intervention-url-mappings.txt', (mapEntry) => {
            let codes = mapEntry.codes.join(',');
            return `${codes}|${mapEntry.friendlyUrl}`
        });

        await outputMappingFile(tooLongURLs, './intervention-url-toolong.txt', (mapEntry) => {
            let codes = mapEntry.codes.join(',');
            return `${codes}|${mapEntry.friendlyUrl}`
        });
        
    } else {
        logger.error("Invalid intervention Mappings Found")
    }
}

async function entry() {
    logger.info("Beginning Run")

    try {
        await diseaseMappings();
        await interventionMappings();
    } catch (err) {
        console.error(err);
    }
    logger.info("Completed Run")
}

entry();