const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'meus_uploads', 'enare_completo.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(rawData);

console.log('🔍 Estrutura do primeiro item (raw):');
if (Array.isArray(data)) {
    console.log(JSON.stringify(data[0], null, 2));
} else {
    console.log('Objeto raiz:', Object.keys(data));
    if (data.questions) {
        console.log('Primeira questão:', JSON.stringify(data.questions[0], null, 2));
    }
}
