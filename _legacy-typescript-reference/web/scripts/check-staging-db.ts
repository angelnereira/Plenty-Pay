import { Client } from 'pg';

import { config } from 'dotenv';
import path from 'path';

// Load .env.staging if it exists, otherwise .env
config({ path: path.resolve(__dirname, '../.env.staging') });
config({ path: path.resolve(__dirname, '../.env') });

// Use DATABASE_URL which should be loaded from .env.staging
const stagingUrl = process.env.DATABASE_URL;

async function checkConnection() {
    if (!stagingUrl) {
        console.error('❌ Error: DATABASE_URL is not defined in environment variables.');
        process.exit(1);
    }

    console.log('Testing connection to Staging DB...');
    console.log('URL: ' + stagingUrl.replace(/:[^:]*@/, ':****@')); // Mask password

    const client = new Client({
        connectionString: stagingUrl,
    });

    try {
        await client.connect();
        console.log('✅ Connection successful!');
        const res = await client.query('SELECT version();');
        console.log('DB Version:', res.rows[0].version);

        const userCount = await client.query('SELECT count(*) FROM users;');
        console.log('User count:', userCount.rows[0].count);

        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err);
        process.exit(1);
    }
}

checkConnection();
