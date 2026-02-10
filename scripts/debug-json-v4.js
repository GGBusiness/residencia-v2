const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'meus_uploads', 'enare_completo.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(rawData);

if (Array.isArray(data) && data.length > 0) {
    const item = data[0];
    console.log('--- CHAVES DO PRIMEIRO ITEM ---');
    console.log(JSON.stringify(Object.keys(item), null, 2));
}
