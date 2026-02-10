const fs = require('fs');
const path = require('path');

const responsePath = path.join(__dirname, '..', 'claude_response.json');

if (!fs.existsSync(responsePath)) {
    console.error('❌ Arquivo claude_response.json não encontrado. Execute o script PowerShell primeiro.');
    process.exit(1);
}

try {
    const data = fs.readFileSync(responsePath, 'utf8');
    const result = JSON.parse(data);

    const responseText = result.content[0].text;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
        console.error('❌ JSON não encontrado na resposta do Claude.');
        console.log(responseText.slice(0, 500));
        process.exit(1);
    }

    const questions = JSON.parse(jsonMatch[0]);
    console.log(`✅ ${questions.length} questões encontradas.`);

    // Gerar SQL (simplificado para ENARE 2024 por enquanto)
    const institution = 'ENARE';
    const year = 2024;

    const outputFilename = `import-${institution.toLowerCase()}-${year}.sql`;
    let sql = `-- Questões ${institution} ${year}\n\n`;

    questions.forEach((q) => {
        const text = (q.texto_questao || '').replace(/'/g, "''");
        const optA = (q.alternativa_a || '').replace(/'/g, "''");
        const optB = (q.alternativa_b || '').replace(/'/g, "''");
        const optC = (q.alternativa_c || '').replace(/'/g, "''");
        const optD = (q.alternativa_d || '').replace(/'/g, "''");
        const optE = q.alternativa_e ? `'${q.alternativa_e.replace(/'/g, "''")}'` : 'NULL';
        const area = (q.area || 'Todas as áreas').replace(/'/g, "''");
        const subarea = q.subarea ? `'${q.subarea.replace(/'/g, "''")}'` : 'NULL';
        const diff = q.dificuldade || 'media';

        sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${area}', ${subarea}, '${diff}', '${text}', '${optA}', '${optB}', '${optC}', '${optD}', ${optE}, 'A');\n\n`;
    });

    fs.writeFileSync(outputFilename, sql, 'utf-8');
    console.log(`✅ Arquivo SQL gerado: ${outputFilename}`);

} catch (error) {
    console.error('❌ Erro ao processar:', error);
}
