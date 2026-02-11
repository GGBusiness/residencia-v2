
import { db } from '../lib/db';

async function migrate() {
    console.log('🚀 Adding best_study_time column to user_profiles...');
    try {
        await db.query(`
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS best_study_time VARCHAR(20) DEFAULT 'noite';
        `);
        console.log('✅ Column added (or already exists).');
    } catch (error) {
        console.error('❌ Error applying migration:', error);
    }
}

migrate();
