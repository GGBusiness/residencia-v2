// Script para importar questões de JSON copiado do ChatGPT
// USO: Cole o JSON do ChatGPT em um arquivo .json na pasta meus_uploads
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function importFromJson() {
    console.log('🚀 Importador de JSON do ChatGPT');
    console.log('================================\n');

    const uploadsDir = path.join(process.cwd(), 'meus_uploads');

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('📁 Pasta meus_uploads criada');
    }

    // Listar arquivos JSON
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
        console.log('❌ Nenhum arquivo .json encontrado em meus_uploads/');
        console.log('\n📝 COMO USAR:');
        console.log('1. Abra o ChatGPT (chat.openai.com)');
        console.log('2. Envie o PDF e peça para extrair as questões em JSON');
        console.log('3. Copie o JSON retornado');
        console.log('4. Cole em um arquivo .json na pasta meus_uploads');
        console.log('5. Rode este script novamente\n');
        return;
    }

    console.log(`📄 Encontrados ${files.length} arquivo(s) JSON\n`);

    let totalInserted = 0;
    let totalErrors = 0;

    for (const file of files) {
        console.log(`\n📋 Processando: ${file}`);

        try {
            const content = fs.readFileSync(path.join(uploadsDir, file), 'utf-8');
            let questions: any[];

            try {
                questions = JSON.parse(content);
            } catch (e) {
                // Tentar extrair JSON de texto com markdown
                const match = content.match(/\[[\s\S]*\]/);
                if (match) {
                    questions = JSON.parse(match[0]);
                } else {
                    console.log('❌ JSON inválido');
                    continue;
                }
            }

            if (!Array.isArray(questions)) {
                console.log('❌ O arquivo não contém um array de questões');
                continue;
            }

            console.log(`📊 ${questions.length} questões encontradas`);

            // Detectar instituição/ano do nome do arquivo
            const lower = file.toLowerCase();
            let institution = 'ENARE';
            let year = 2024;

            if (lower.includes('unicamp')) institution = 'UNICAMP';
            else if (lower.includes('usp')) institution = 'USP';
            else if (lower.includes('unifesp')) institution = 'UNIFESP';
            else if (lower.includes('iscmsp')) institution = 'ISCMSP';
            else if (lower.includes('sus')) institution = 'SUS-SP';
            else if (lower.includes('psu')) institution = 'PSU-MG';
            else if (lower.includes('unesp')) institution = 'UNESP';

            if (lower.includes('2021')) year = 2021;
            else if (lower.includes('2022')) year = 2022;
            else if (lower.includes('2023')) year = 2023;
            else if (lower.includes('2024')) year = 2024;
            else if (lower.includes('2025')) year = 2025;
            else if (lower.includes('2026')) year = 2026;

            console.log(`🏥 Instituição detectada: ${institution} ${year}`);

            // Inserir cada questão
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];

                const question = {
                    institution: q.institution || institution,
                    year: q.year || year,
                    area: q.area || 'Todas as áreas',
                    subarea: q.subarea || null,
                    difficulty: q.dificuldade || q.difficulty || 'media',
                    question_text: q.texto_questao || q.question_text || q.enunciado || '',
                    option_a: q.alternativa_a || q.option_a || q.a || '',
                    option_b: q.alternativa_b || q.option_b || q.b || '',
                    option_c: q.alternativa_c || q.option_c || q.c || '',
                    option_d: q.alternativa_d || q.option_d || q.d || '',
                    option_e: q.alternativa_e || q.option_e || q.e || null,
                    correct_answer: q.gabarito || q.correct_answer || q.resposta || 'A'
                };

                if (!question.question_text) {
                    console.log(`⚠️ Questão ${i + 1} sem texto - pulando`);
                    totalErrors++;
                    continue;
                }

                const { error } = await supabase.from('questions').insert(question);

                if (error) {
                    if (!error.message.includes('duplicate')) {
                        console.log(`❌ Erro ${i + 1}: ${error.message.slice(0, 50)}`);
                        totalErrors++;
                    }
                } else {
                    totalInserted++;
                }
            }

            // Mover arquivo processado
            const processedDir = path.join(uploadsDir, 'processados');
            if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir);
            fs.renameSync(
                path.join(uploadsDir, file),
                path.join(processedDir, file)
            );
            console.log(`✅ Arquivo movido para processados/`);

        } catch (e: any) {
            console.log(`❌ Erro: ${e.message}`);
            totalErrors++;
        }
    }

    console.log('\n================================');
    console.log('📊 RESUMO');
    console.log('================================');
    console.log(`✅ Inseridas: ${totalInserted} questões`);
    console.log(`❌ Erros: ${totalErrors}`);

    // Total no banco
    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    console.log(`\n📈 Total no banco: ${count} questões`);
}

importFromJson().catch(console.error);
