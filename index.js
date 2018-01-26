/**************************
*
* The following is a script that may be used to extract EVS terminology
* from the EVSAPI to be used by dynamic listing pages.  The logic loosely
* mirrors the logic in the CTSAPI enrichment process
*
***************************/

'use strict';

const config            = require('config');

const EvsApiClient      = require('./lib/evs-api/evs-api-client');

let server = 'evsrestapi.nci.nih.gov';
let rootConceptID = 'C2991';

let client = new EvsApiClient('', server, 'https');

async function main() {
    await client.getConcept(rootConceptID);
}

main();
