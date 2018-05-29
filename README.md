# wcms-cts-term-map-gen
Term mapping file generator for Clinical Trial listing pages in the WCMS

## Before Running
1. 'nvm use' or 'nodist use' (to install Node v8)
2. npm install

## To Recreate EVS Mappings
1. Clear out the ./term_cache folder if it contains anything.
2. run `node evs_index.js` 

NOTE: If the API goes down, just wait a bit and run again.  It will only grab those items NOT in the term_cache folder.  This also means that you should NOT clear out the term_cache folder before each run if the API crashes...

Basically, run it until you see output that looks like:
``
info: Beginning Run {}
info: Fetching Disease Terms {}
info: Fetched 35124 disease terms {}
info: Rolling Up disease Mappings {}
info: Rolled up 34245 disease mappings {}
info: All disease mappings are valid - outputting. Names: 34245 URLS: 14227 {}
info: Fetching Intervention Terms {}
info: Fetched 19146 intervention terms {}
info: Rolling Up intervention Mappings {}
info: Rolled up 19137 intervention mappings {}
info: All intervention mappings are valid - outputting. Names: 19137  URLS: 19004 {}
info: Completed Run {}
``
