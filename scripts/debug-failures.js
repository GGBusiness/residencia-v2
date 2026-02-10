const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'meus_uploads', 'enare_completo.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const questions = JSON.parse(rawData);

console.log('🔍 Analisando falhas de extração...');

let failCount = 0;
const maxFails = 5;

questions.forEach((q, index) => {
    if (failCount >= maxFails) return;

    // Tentar lógica do script
    let correctAnswer = null;
    let foundIn = '';

    const processText = (text) => {
        if (!text || typeof text !== 'string') return null;
        const match = text.match(/Gabarito:\s*([A-E])/i);
        return match ? match[1].toUpperCase() : null;
    };

    const alts = [q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e];

    alts.forEach((a, i) => {
        const found = processText(a);
        if (found) {
            correctAnswer = found;
            foundIn = `Alternativa ${['A', 'B', 'C', 'D', 'E'][i]}`;
        }
    });

    if (!correctAnswer) correctAnswer = q.gabarito || q.resposta || q.resposta_correta;
    if (!correctAnswer && q.texto_questao) {
        const match = q.texto_questao.match(/Gabarito:\s*([A-E])/i);
        if (match) {
            correctAnswer = match[1].toUpperCase();
            foundIn = 'Texto da Questão';
        }
    }

    if (!correctAnswer) {
        failCount++;
        console.log(`\n❌ Falha #${failCount} (Item ${index}):`);
        console.log(`Texto: ${q.texto_questao ? q.texto_questao.substring(0, 50) + '...' : 'SEM TEXTO'}`);
        console.log('Alternativas (fechamento):');
        alts.forEach((a, k) => {
            if (a) {
                // Mostrar os ultimos 50 caracteres da alternativa para ver se tem gabarito
                console.log(`   ${['A', 'B', 'C', 'D', 'E'][k]}: ...${a.slice(-60)}`);
            } else {
                console.log(`   ${['A', 'B', 'C', 'D', 'E'][k]}: null`);
            }
        });
    }
});
