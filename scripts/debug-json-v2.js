const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'meus_uploads', 'enare_completo.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(rawData);

if (Array.isArray(data) && data.length > 0) {
    const item = data[0];
    console.log('🔑 Chaves do objeto:', Object.keys(item));
    console.log('📄 Exemplo de item:', JSON.stringify(item, null, 2));
} else {
    console.log('❌ JSON não é um array ou está vazio.');
}
