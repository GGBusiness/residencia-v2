
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContent() {
    console.log('🔍 Checking available content in database...');

    const { data: documents, error } = await supabase
        .from('documents')
        .select('institution, year, area')
        .eq('type', 'PROVA');

    if (error) {
        console.error('Error fetching documents:', error);
        return;
    }

    if (!documents || documents.length === 0) {
        console.log('❌ No documents found.');
        return;
    }

    console.log(`✅ Found ${documents.length} total exams (documents).`);

    // Group by Institution
    const institutions: Record<string, number> = {};
    const years: Record<number, number> = {};
    const areas: Record<string, number> = {};

    documents.forEach(doc => {
        if (doc.institution) {
            institutions[doc.institution] = (institutions[doc.institution] || 0) + 1;
        }
        if (doc.year) {
            years[doc.year] = (years[doc.year] || 0) + 1;
        }
        if (doc.area) {
            areas[doc.area] = (areas[doc.area] || 0) + 1;
        }
    });

    console.log('\n🏛️  INSTITUTIONS FOUND:');
    Object.entries(institutions)
        .sort(([, a], [, b]) => b - a)
        .forEach(([inst, count]) => {
            console.log(`- ${inst}: ${count} exams`);
        });

    console.log('\n📅  YEARS FOUND:');
    Object.entries(years)
        .sort(([, a], [, b]) => Number(b) - Number(a)) // Latest first
        .forEach(([year, count]) => {
            console.log(`- ${year}: ${count} exams`);
        });

    console.log('\n🩺 AREAS FOUND:');
    Object.entries(areas)
        .sort(([, a], [, b]) => b - a)
        .forEach(([area, count]) => {
            console.log(`- ${area}: ${count} exams`);
        });
}

checkContent();
