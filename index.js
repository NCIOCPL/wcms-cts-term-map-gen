/**************************
*
* The following is a script that may be used to extract EVS terminology
* from the EVSAPI to be used by dynamic listing pages.  The logic loosely
* mirrors the logic in the CTSAPI enrichment process
*
***************************/

'use strict';
const _                 = require('lodash');
const config            = require('config');

const EvsApiClient      = require('./lib/evs-api/evs-api-client');

let server = 'evsrestapi.nci.nih.gov';
//let rootConceptID = 'C2991';
let rootConceptID = 'C4872';

let client = new EvsApiClient('', server, 'https');


async function fetchTermAndChildren(termID) {
console.log(`Fetching ${termID}`);

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
 * Gets a friendly URL strinb based on a display name
 * @param {*} displayName 
 */
function getFriendlyUrlForDisplayName(displayName) {
    
}

async function main() {
    
    let allMappings = {};

    //Fetch all EVS diseases
    let allDiseases = await fetchTermAndChildren(rootConceptID);
    
    //Now we iterate over the disease list
    for (let i=0; i < allDiseases.length; i++) {
        //Figure out pretty name
        let cncpt = allDiseases[i];

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
                codes: [],
                friendlyUrl: getFriendlyUrlForDisplayName(displayName)
            };
        }
        
        allMappings[displayName].codes.push(cncpt.code);
    }


    console.log(allMappings);
}

main();