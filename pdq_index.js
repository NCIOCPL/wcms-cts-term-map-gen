'use strict';

const _                     = require('lodash');
const fs                    = require('fs');
const parse                 = require('csv-parse');
const diacritics            = require('diacritics');
const path                  = require('path');
const util                  = require('util');
const winston               = require('winston');

const EvsApiClient      = require('./lib/evs-api/evs-api-client');
const EvsNotFoundException  = require('./lib/evs-api/evs-not-found-exception');

const readFileAsync = util.promisify(fs.readFile);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console()
    ]
})

const validUrlRegex = /^[a-z0-9\-]+$/;
const glossDir = path.join(__dirname, "source");
const outputDir = path.join(__dirname);
let server = 'evsrestapi.nci.nih.gov'; 

let client = new EvsApiClient(logger, server, 'https');

const MAX_URL_LEN = 75;

const IGNORE_CODES = [
    '44404', '377721', '423251', '635470', '653110', '757144',
    '44971', '44404', '46221', '423251', '377721', '643063',
    '653110', '757144', '721308', '39298', '476335', '531923'
]


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
            .replace(/[",+().ª'’[：:*\\\]]+/g, "")
            .replace(/(\s+|[;_&–/])/g, "-")
            .replace(/[μ]+/g, "u") //Dunno why diacritics did not handle this
            .replace(/[β]+/g, "b") //Dunno why diacritics did not handle this
            .replace(/[α]+/g, "a") //Dunno why diacritics did not handle this
            .replace(/[%]+/g,'pct');
    //Replace non-latin characters (e.g. greek) with latin equivelents. n
 
    return url;
}

function readCSVFileToArr(inputStream, transformFn) {

    return new Promise((resolve, reject) => {

        let output = [];
        let record = null;
        const parser = parse({ delimiter: '|', auto_parse: false})
            .on('readable', () => {
                while(record = parser.read()) {
                    output.push(transformFn.call(null, record))
                }
            })
            .on('error', (err) => {
                reject(err);
            })
            .on('finish', () => {
                resolve(output);
            });

        inputStream.pipe(parser);
    });
}


async function getMappingFromGlossFile(fileName, transformFn) {
    let inputStream = fs.createReadStream(fileName);    
    return await readCSVFileToArr(inputStream, transformFn);
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

function validateMappings(allMappings) {

    let hasErrors = false;
    let urls = {};

    //We know all display names are unique because we are a dictionary
    //lets make sure that:
    //  1) All URLs would be unique
    //  2) All URLs match a-z0-9\-
    allMappings.forEach((mapping) => {
        if (Object.keys(urls).includes(mapping.friendlyUrl)) {
            hasErrors = true;
            logger.error(`Validation Error: Duplicate URL ${mapping.friendlyUrl}: Code: ${urls[mapping.friendlyUrl].code} -- ${mapping.code} `)
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

function transformGlossEntry(record) {
    return {
        code: record[0],
        name: record[1],
        friendlyUrl: getFriendlyUrlForDisplayName(record[1])
    }
}

async function processGlossary(fileName) {

    let tooLongUrls = [];

    logger.info(`Processing ${fileName}`);

    let glossary = await getMappingFromGlossFile(
        path.join(glossDir, `${fileName}.txt`),
        transformGlossEntry
    );

    let tooLongURLs = [];

    let mappingsForUrls = _.filter(glossary, (mapping) => {
        if (IGNORE_CODES.includes(mapping.code)) {
            return false;
        }

        if (mapping.friendlyUrl.length > MAX_URL_LEN) {
            tooLongURLs.push({
                friendlyUrl: mapping.friendlyUrl,
                code: mapping.code
            });
            return false;
        }

        return true;
    });

    if (validateMappings(mappingsForUrls)) {
        await outputMappingFile(mappingsForUrls, `./${fileName}-url-mappings.txt`, (mapEntry) => {
            return `${mapEntry.code}|${mapEntry.friendlyUrl}`
        });

        await outputMappingFile(tooLongURLs, `./${fileName}-url-toolong.txt`, (mapEntry) => {
            return `${mapEntry.code}|${mapEntry.friendlyUrl}`
        });
    }    
}

async function processTerms(fileName) {
    logger.info(`Processing ${fileName}`)
    let glossary = await getMappingFromGlossFile(
        path.join(glossDir, `${fileName}.txt`),
        (record) => {
            return {
                code: record[0],
                name: record[1],
                nctid: record[2],
                friendlyUrl: getFriendlyUrlForDisplayName(record[1]),
                evsUrl: null
            }
        }
    );

    let badCode = 0;
    let noCode = 0;
    let nameMismatch = 0;

    //Now let's ask EVS what the urls/names should be
    await Promise.all(
        glossary.map(async (term) => {            
            if (term.nctid != 'NULL') {
                try {
                    let cncpt = await client.getConcept(term.nctid.toUpperCase());

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

                    term.evsUrl = getFriendlyUrlForDisplayName(displayName);

                    if (term.evsUrl != term.friendlyUrl) {
                        //logger.warn(`Validation Warning: Term ${term.code} name mismatch ${term.friendlyUrl} - ${term.evsUrl}`);
                        nameMismatch++;
                    }

                } catch (err) {
                    if (err instanceof EvsNotFoundException) {
                        term.nctid = term.nctid + ' - NOT FOUND';
                        badCode++;
                        //logger.warn(`Validation Warning: Term ${term.code} with code ${term.nctid} not found in EVS`);
                    } else {
                        throw err;
                    }
                }
            } else {
                //logger.warn(`Validation Warning: Term ${term.code} does not have NCIT ID`);
                noCode++;
            }
        })
    );

    if (badCode > 0 || noCode > 0 ) {
        logger.warn(`Validation Warning: ${badCode} drugs have a bad EVS ID, ${noCode} and ${nameMismatch} names do not match have none out of ${glossary.length} drugs`)
    }

    let tooLongURLs = [];

    let mappingsForUrls = _.filter(glossary, (mapping) => {
        if (IGNORE_CODES.includes(mapping.code)) {
            return false;
        }

        if (mapping.friendlyUrl.length > MAX_URL_LEN) {
            tooLongURLs.push({
                friendlyUrl: mapping.friendlyUrl,
                code: mapping.code
            });
            return false;
        }

        return true;
    });

    if (validateMappings(mappingsForUrls)) {
        await outputMappingFile(mappingsForUrls, `./${fileName}-url-mappings.txt`, (mapEntry) => {
            return `${mapEntry.code}|${mapEntry.friendlyUrl}`
        });

        await outputMappingFile(tooLongURLs, `./${fileName}-url-toolong.txt`, (mapEntry) => {
            return `${mapEntry.code}|${mapEntry.friendlyUrl}`
        });
    }
}

async function main() {    

    await processGlossary('englishGlossary');
    await processGlossary('SpanishGlossary');
    await processGlossary('englishGenetic');
    await processTerms('drugs');
}

main();