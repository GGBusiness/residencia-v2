// Script para consertar o JSON truncado e gerar SQL
const fs = require('fs');

const responseText = fs.readFileSync('claude-response-text.txt', 'utf-8');

console.log('📄 Tamanho do texto:', responseText.length, 'caracteres');

// Encontrar o último objeto JSON completo (terminando com })
const lastCompleteIndex = responseText.lastIndexOf('},');
console.log('🔍 Último objeto completo em posição:', lastCompleteIndex);

if (lastCompleteIndex === -1) {
    console.error('❌ Não foi possível encontrar objetos JSON completos');
    process.exit(1);
}

// Cortar até o último objeto completo e fechar o array
const fixedJson = responseText.slice(0, lastCompleteIndex + 1) + '\n]';

console.log('🔧 JSON corrigido - últimos 100 chars:', fixedJson.slice(-100));

try {
    const questions = JSON.parse(fixedJson);
    console.log(`\n✅ ${questions.length} questões recuperadas com sucesso!`);

    // Verificar gabaritos
    let comGabarito = 0;
    let semGabarito = 0;

    questions.forEach(q => {
        if (q.gabarito && q.gabarito !== null) {
            comGabarito++;
        } else {
            semGabarito++;
        }
    });

    console.log(`📊 Com gabarito: ${comGabarito}`);
    console.log(`📊 Sem gabarito: ${semGabarito}`);

    // Mostrar primeiras 3 questões como amostra
    console.log('\n📋 Amostra das primeiras 3 questões:');
    for (let i = 0; i < Math.min(3, questions.length); i++) {
        const q = questions[i];
        console.log(`  ${q.numero}. ${q.texto_questao?.slice(0, 60)}... | Gabarito: ${q.gabarito || 'N/A'}`);
    }

    // Gerar SQL
    const institution = 'ENARE';
    const year = 2024;

    let sql = `-- Questões ${institution} ${year}\n`;
    sql += `-- Gerado em: ${new Date().toISOString()}\n`;
    sql += `-- Total: ${questions.length} questões\n\n`;

    questions.forEach(q => {
        const text = (q.texto_questao || '').replace(/'/g, "''");
        const optA = (q.alternativa_a || '').replace(/'/g, "''");
        const optB = (q.alternativa_b || '').replace(/'/g, "''");
        const optC = (q.alternativa_c || '').replace(/'/g, "''");
        const optD = (q.alternativa_d || '').replace(/'/g, "''");
        const optE = q.alternativa_e ? `'${q.alternativa_e.replace(/'/g, "''")}'` : 'NULL';
        const area = (q.area || 'Todas as áreas').replace(/'/g, "''");
        const subarea = q.subarea ? `'${q.subarea.replace(/'/g, "''")}'` : 'NULL';
        const diff = q.dificuldade || 'media';
        const correctAnswer = q.gabarito || 'A';

        sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${area}', ${subarea}, '${diff}', '${text}', '${optA}', '${optB}', '${optC}', '${optD}', ${optE}, '${correctAnswer}');\n\n`;
    });

    const outputFile = `import-enare-2024.sql`;
    fs.writeFileSync(outputFile, sql, 'utf-8');
    console.log(`\n✅ Arquivo SQL gerado: ${outputFile}`);
    console.log(`📊 Tamanho: ${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB`);

    // Salvar JSON corrigido também
    fs.writeFileSync('enare-2024-questions.json', JSON.stringify(questions, null, 2), 'utf-8');
    console.log('✅ JSON limpo salvo: enare-2024-questions.json');

} catch (e) {
    console.error('❌ Erro ao parsear JSON:', e.message);
}
