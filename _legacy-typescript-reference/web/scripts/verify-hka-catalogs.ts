
import { CURRENCIES } from '../features/hka/model/types/catalogs/constants/currencies';
import { UNITS } from '../features/hka/model/types/catalogs/constants/units';
import { INCOTERMS } from '../features/hka/model/types/catalogs/constants/incoterms';
import { COUNTRIES } from '../features/hka/model/types/catalogs/constants/countries';
import { LOCATIONS } from '../features/hka/model/types/catalogs/constants/locations';
import { SEGMENTS, FAMILIES } from '../features/hka/model/types/catalogs/constants/goods-services';

async function verifyCatalogs() {
    console.log('Verifying HKA Catalogs...');
    let errors = 0;

    // Currencies
    const currencyCount = Object.keys(CURRENCIES).length;
    console.log(`Currencies: ${currencyCount} entries`);
    if (currencyCount === 0) {
        console.error('ERROR: CURRENCIES is empty');
        errors++;
    } else {
        console.log(`  Sample: PAB -> ${CURRENCIES['PAB']}`);
    }

    // Units
    const unitCount = Object.keys(UNITS).length;
    console.log(`Units: ${unitCount} entries`);
    if (unitCount === 0) {
        console.error('ERROR: UNITS is empty');
        errors++;
    } else {
        // Check for some known units
        const m = UNITS['m'];
        const kg = UNITS['kg'] || UNITS['KG']; // Check casing
        console.log(`  Sample: m -> ${m}`);
    }

    // Incoterms
    const incotermCount = Object.keys(INCOTERMS).length;
    console.log(`Incoterms: ${incotermCount} entries`);
    if (incotermCount === 0) {
        console.error('ERROR: INCOTERMS is empty');
        errors++;
    } else {
        console.log(`  Sample: FOB -> ${INCOTERMS['FOB']}`);
    }

    // Countries
    const countryCount = Object.keys(COUNTRIES).length;
    console.log(`Countries: ${countryCount} entries`);
    if (countryCount === 0) {
        console.error('ERROR: COUNTRIES is empty');
        errors++;
    } else {
        console.log(`  Sample: PA -> ${COUNTRIES['PA']}`);
    }

    // Locations
    const locationCount = Object.keys(LOCATIONS).length;
    console.log(`Locations: ${locationCount} entries`);
    if (locationCount === 0) {
        console.error('ERROR: LOCATIONS is empty');
        errors++;
    } else {
        const loc = LOCATIONS['8-8-1']; // San Felipe
        console.log(`  Sample: 8-8-1 -> ${JSON.stringify(loc)}`);
    }

    // Goods and Services
    const segmentCount = SEGMENTS.length;
    console.log(`Segments: ${segmentCount} entries`);
    if (segmentCount === 0) {
        console.error('ERROR: SEGMENTS is empty');
        errors++;
    } else {
        console.log(`  Sample: ${JSON.stringify(SEGMENTS[0])}`);
    }

    const familyCount = FAMILIES.length;
    console.log(`Families: ${familyCount} entries`);
    if (familyCount === 0) {
        console.error('ERROR: FAMILIES is empty');
        errors++;
    } else {
        console.log(`  Sample: ${JSON.stringify(FAMILIES[0])}`);
    }

    if (errors > 0) {
        console.error(`\nverification FAILED with ${errors} errors.`);
        process.exit(1);
    } else {
        console.log('\nVerification SUCCESSFUL.');
    }
}

verifyCatalogs().catch(console.error);
