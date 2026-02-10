const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'meus_uploads');
const outputDir = path.join(__dirname, '..');

if (!fs.existsSync(uploadsDir)) {
    console.error(`❌ Pasta não encontrada: ${uploadsDir}`);
    process.exit(1);
}

console.log('🚀 Iniciando processamento de arquivos JSON manuais...\n');

const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
    console.log('⚠️ Nenhum arquivo .json encontrado na pasta "meus_uploads".');
    console.log('📌 Salve o resultado do Claude nesta pasta com extensão .json (ex: enare2024.json)');
    process.exit(0);
}

console.log(`📂 Encontrados ${files.length} arquivos para processar.\n`);

files.forEach(file => {
    const filePath = path.join(uploadsDir, file);
    const filename = path.basename(file, '.json');
    console.log(`📄 Processando: ${file}`);

    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Tentar limpar markdown code blocks se o usuário colou com ```json
        let cleanContent = content;
        if (content.includes('```json')) {
            cleanContent = content.split('```json')[1].split('```')[0].trim();
        } else if (content.includes('```')) {
            cleanContent = content.split('```')[1].split('```')[0].trim();
        }

        const questions = JSON.parse(cleanContent);

        if (!Array.isArray(questions)) {
            console.error(`❌ Erro em ${file}: O conteúdo não é um array JSON.`);
            return;
        }

        console.log(`   ✅ Validado: ${questions.length} questões.`);

        // Detectar instituição/ano pelo nome do arquivo (básico)
        let institution = 'ENARE';
        let year = 2024; // Default

        if (filename.toLowerCase().includes('unicamp')) institution = 'UNICAMP';
        if (filename.toLowerCase().includes('usp')) institution = 'USP';

        if (filename.includes('2021')) year = 2021;
        if (filename.includes('2022')) year = 2022;
        if (filename.includes('2023')) year = 2023;
        if (filename.includes('2025')) year = 2025;
        if (filename.includes('2026')) year = 2026;

        // Gerar SQL
        const outputFilename = `import-${filename}.sql`;
        const outputPath = path.join(outputDir, outputFilename);

        let sql = `-- Importação Manual: ${file}\n`;
        sql += `-- Instituição: ${institution}, Ano: ${year}\n\n`;

        questions.forEach((q, idx) => {
            const text = (q.texto_questao || '').replace(/'/g, "''").replace(/\n/g, '\\n');
            const optA = (q.alternativa_a || '').replace(/'/g, "''");
            const optB = (q.alternativa_b || '').replace(/'/g, "''");
            const optC = (q.alternativa_c || '').replace(/'/g, "''");
            const optD = (q.alternativa_d || '').replace(/'/g, "''");
            const optE = q.alternativa_e ? `'${q.alternativa_e.replace(/'/g, "''")}'` : 'NULL';
            const area = (q.area || 'Todas as áreas').replace(/'/g, "''");
            const subarea = q.subarea ? `'${q.subarea.replace(/'/g, "''")}'` : 'NULL';
            const diff = q.dificuldade || 'media';

            // Tentar extrair imagem se estiver no formato [Imagem: ...]
            // (Lógica futura - por enquanto salva no texto mesmo)

            sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${area}', ${subarea}, '${diff}', '${text}', '${optA}', '${optB}', '${optC}', '${optD}', ${optE}, 'A');\n\n`;
        });

        fs.writeFileSync(outputPath, sql, 'utf-8');
        console.log(`   💾 SQL gerado: ${outputFilename}\n`);

    } catch (error) {
        console.error(`❌ Erro ao processar ${file}:`, error.message);
    }
});

console.log('✅ Finalizado! Execute os arquivos SQL gerados no Supabase.');
