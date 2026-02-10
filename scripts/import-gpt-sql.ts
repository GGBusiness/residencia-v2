// Importa SQLs gerados pelo GPT
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function importGptSql() {
    console.log('🚀 Importando SQLs do GPT...\n');

    // Encontrar arquivos SQL do GPT
    const files = fs.readdirSync('.').filter(f => f.endsWith('-gpt.sql'));

    if (files.length === 0) {
        console.log('❌ Nenhum arquivo *-gpt.sql encontrado');
        return;
    }

    let totalInserted = 0;
    let totalErrors = 0;

    for (const file of files) {
        console.log(`📄 ${file}`);
        const sql = fs.readFileSync(file, 'utf-8');

        const inserts = sql.match(/INSERT INTO questions[^;]+;/g) || [];
        console.log(`   ${inserts.length} questões`);

        for (const insert of inserts) {
            const match = insert.match(/VALUES\s*\((.*)\);$/s);
            if (!match) continue;

            try {
                // Parse simplificado
                const values = match[1];
                const strings: string[] = [];
                let current = '';
                let inString = false;

                for (let i = 0; i < values.length; i++) {
                    const char = values[i];
                    if (char === "'" && values[i - 1] !== "'") {
                        if (inString) {
                            strings.push(current);
                            current = '';
                        }
                        inString = !inString;
                    } else if (inString) {
                        current += char;
                    }
                }

                const yearMatch = values.match(/,\s*(\d{4})\s*,/);
                const year = yearMatch ? parseInt(yearMatch[1]) : 2024;

                if (strings.length >= 10) {
                    const { error } = await supabase.from('questions').insert({
                        institution: strings[0],
                        year,
                        area: strings[1],
                        subarea: strings[2] || null,
                        difficulty: strings[3],
                        question_text: strings[4].replace(/''/g, "'"),
                        option_a: strings[5].replace(/''/g, "'"),
                        option_b: strings[6].replace(/''/g, "'"),
                        option_c: strings[7].replace(/''/g, "'"),
                        option_d: strings[8].replace(/''/g, "'"),
                        option_e: strings[9]?.replace(/''/g, "'") || null,
                        correct_answer: strings[10] || 'A'
                    });

                    if (error && !error.message.includes('duplicate')) {
                        totalErrors++;
                    } else if (!error) {
                        totalInserted++;
                    }
                }
            } catch (e) {
                totalErrors++;
            }
        }
    }

    console.log(`\n✅ Inseridas: ${totalInserted}`);
    console.log(`❌ Erros: ${totalErrors}`);

    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    console.log(`\n📈 Total no banco: ${count}`);
}

importGptSql().catch(console.error);
