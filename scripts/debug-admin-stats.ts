import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../lib/db';

async function testQuery() {
    console.log('Testing queries...');
    try {
        const { rows } = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'profiles'
        `);
        console.log('Columns in profiles:', rows.map(r => r.column_name));
    } catch (e: any) {
        console.error('Test error:', e.message);
    }
    process.exit(0);
}
testQuery();
