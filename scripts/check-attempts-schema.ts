
import { db, query } from './lib/db';

async function checkSchema() {
    try {
        console.log('🔍 Checking `attempts` table schema...');
        const { rows } = await query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'attempts';
        `);
        console.table(rows);
    } catch (error) {
        console.error('❌ Error checking schema:', error);
    }
}

checkSchema();
