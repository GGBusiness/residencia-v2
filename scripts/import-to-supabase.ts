// Script para importar SQL consolidado no Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function importQuestions() {
    console.log('🚀 Iniciando importação para Supabase...');
    console.log(`📍 URL: ${supabaseUrl}`);

    // Ler arquivos SQL
    const files = [
        'import-enare-2023-objetiva.sql',
        'import-enare-2024.sql'
    ];

    let totalInserted = 0;
    let totalErrors = 0;

    for (const file of files) {
        if (!fs.existsSync(file)) {
            console.log(`⚠️ Arquivo não encontrado: ${file}`);
            continue;
        }

        console.log(`\n📄 Processando: ${file}`);
        const sql = fs.readFileSync(file, 'utf-8');

        // Extrair os INSERTs
        const insertMatches = sql.match(/INSERT INTO questions[^;]+;/g);

        if (!insertMatches) {
            console.log(`⚠️ Nenhum INSERT encontrado em: ${file}`);
            continue;
        }

        console.log(`📊 ${insertMatches.length} questões encontradas`);

        // Processar cada INSERT manualmente
        for (let i = 0; i < insertMatches.length; i++) {
            const insert = insertMatches[i];

            // Extrair VALUES
            const valuesMatch = insert.match(/VALUES\s*\((.*)\);$/s);
            if (!valuesMatch) continue;

            const valuesStr = valuesMatch[1];

            // Parse dos valores (simplificado)
            // Formato: ('inst', year, 'area', 'subarea'|NULL, 'diff', 'text', 'a', 'b', 'c', 'd', 'e'|NULL, 'answer')
            try {
                // Extrair valores usando regex
                const regex = /'([^']*(?:''[^']*)*)'/g;
                const stringValues: string[] = [];
                let match;
                while ((match = regex.exec(valuesStr)) !== null) {
                    stringValues.push(match[1].replace(/''/g, "'"));
                }

                // Extrair year (número)
                const yearMatch = valuesStr.match(/,\s*(\d{4})\s*,/);
                const year = yearMatch ? parseInt(yearMatch[1]) : 2024;

                // Verificar se temos valores suficientes
                if (stringValues.length < 10) {
                    console.log(`⚠️ Questão ${i + 1}: valores insuficientes`);
                    totalErrors++;
                    continue;
                }

                // Montar objeto
                const question = {
                    institution: stringValues[0],
                    year: year,
                    area: stringValues[1],
                    subarea: stringValues[2] === 'NULL' ? null : stringValues[2],
                    difficulty: stringValues[3],
                    question_text: stringValues[4],
                    option_a: stringValues[5],
                    option_b: stringValues[6],
                    option_c: stringValues[7],
                    option_d: stringValues[8],
                    option_e: stringValues[9] === 'NULL' ? null : stringValues[9],
                    correct_answer: stringValues[10] || 'A'
                };

                // Inserir no Supabase
                const { error } = await supabase
                    .from('questions')
                    .insert(question);

                if (error) {
                    if (error.message.includes('duplicate')) {
                        // Ignorar duplicatas silenciosamente
                    } else {
                        console.log(`❌ Erro questão ${i + 1}:`, error.message.slice(0, 50));
                        totalErrors++;
                    }
                } else {
                    totalInserted++;
                    if ((i + 1) % 10 === 0) {
                        process.stdout.write(`\r   Inseridas: ${totalInserted}`);
                    }
                }
            } catch (e: any) {
                console.log(`❌ Erro parse questão ${i + 1}:`, e.message);
                totalErrors++;
            }
        }
        console.log();
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('='.repeat(50));
    console.log(`✅ Questões inseridas: ${totalInserted}`);
    console.log(`❌ Erros: ${totalErrors}`);

    // Verificar total no banco
    const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

    console.log(`\n📈 Total de questões no banco: ${count}`);
}

importQuestions().catch(console.error);
