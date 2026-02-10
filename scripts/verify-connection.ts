
import { db, query } from '../lib/db';

async function main() {
    console.log('Testing connection to DigitalOcean...');
    try {
        const start = Date.now();
        const { rows } = await query('SELECT NOW() as time');
        const duration = Date.now() - start;
        console.log('✅ Connection Successful!');
        console.log('Database Time:', rows[0].time);
        console.log('Response Time:', duration + 'ms');
        console.log('Configuration is correct for external access.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection Failed:', error);
        process.exit(1);
    }
}

main();
