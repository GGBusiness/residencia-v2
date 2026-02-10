const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'meus_uploads', 'enare_completo.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(rawData);

if (Array.isArray(data) && data.length > 0) {
    const item = data[0];
    console.log('--- Item 0 ---');
    console.log('Alternativa A:', item.alternativa_a);
    console.log('Alternativa B:', item.alternativa_b);
    console.log('Alternativa C:', item.alternativa_c);
    console.log('Alternativa D:', item.alternativa_d);
    console.log('Alternativa E:', item.alternativa_e);
    console.log('--- Respostas possiveis ---');
    console.log('Gabarito:', item.gabarito);
    console.log('Resposta:', item.resposta);
    console.log('Resposta Correta:', item.resposta_correta);
    console.log('--- Chaves ---');
    console.log(Object.keys(item).join(', '));
    console.log('---');
}
