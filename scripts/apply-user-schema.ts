
import { db, query } from '../lib/db';
import fs from 'fs';
import path from 'path';

async function main() {
    console.log('Applying User Schema to DigitalOcean...');
    try {
        const schemaPath = path.join(process.cwd(), 'scripts', 'setup-user-schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        // Split by statement (simple split by semicolon, might need more robust parsing if logic is complex)
        // But pg driver can often handle multiple statements. Let's try sending it all.
        await query(sql);

        console.log('✅ User Schema applied successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to apply user schema:', error);
        process.exit(1);
    }
}

main();
