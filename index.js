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

// Root disease, disorder or finding
let rootConceptID = 'C7057';

// Disease or Disorder (no findings/side effects/biomarkers)
//let rootConceptID = 'C2991';

//Breast Cancer
//let rootConceptID = 'C4872';
 

let client = new EvsApiClient(logger, server, 'https');
 
 
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
    let url = diacritics.remove(displayName);
    url = url.toLowerCase();
    url = url.replace(/[,+()./'[:*\]]+/g, "");
    url = url.replace(/\s+/g, "-");
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
    
        if (!allMappings[displayName]) {
            allMappings[displayName] = {
                displayName: displayName,
                codes: [],
                friendlyUrl: getFriendlyUrlForDisplayName(displayName)
            };
        }
            
        allMappings[displayName].codes.push(cncpt.code);
    } 
    
    return allMappings;
}

function validateMappings(allMappings) {

    let hasErrors = false;
    let urls = [];

    //We know all display names are unique because we are a dictionary
    //lets make sure that:
    //  1) All URLs would be unique
    //  2) All URLs match a-z0-9\-
    _.forEach(allMappings, (mapping) => {
        if (urls.includes(mapping.friendlyUrl)) {
            hasErrors = true;
            logger.error(`Validation Error: Duplicate URL ${mapping.friendlyUrl}`)
        } else {
            urls.push(mapping.friendlyUrl);
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

/**
 * Outputs both the name mappings and URL mappings
 */
async function outputMappings(allMappings) {

    await outputMappingFile(allMappings, './name-mappings.txt', (mapEntry) => {
        let codes = mapEntry.codes.join(',');
        return `${codes}|${mapEntry.displayName}`
    });

    await outputMappingFile(allMappings, './url-mappings.txt', (mapEntry) => {
        let codes = mapEntry.codes.join(',');
        return `${codes}|${mapEntry.friendlyUrl}`
    });

    return;
}

async function main() {

    logger.info("Beginning Run")

    logger.info("Fetching Terms")
    //Fetch all EVS diseases
    let allDiseases = await fetchTermAndChildren(rootConceptID);
    logger.info(`Fetched ${allDiseases.length} terms`);

    logger.info("Rolling Up Mappings")
    //Roll up the codes to a single mapping
    let allMappings = rollupConceptsToMappings(allDiseases); 
    logger.info(`Rolled up ${Object.keys(allMappings).length} mappings`);
        
    if (validateMappings(allMappings)) {
        logger.info("All mappings are valid - outputting")
        //Output the mappings
        await outputMappings(allMappings);
    } else {
        logger.error("Invalid Mappings Found")
    }

    logger.info("Completed Run")
}

async function entry() {
    try {
        await main();
    } catch (err) {
        console.error(err);
    }
}

entry();