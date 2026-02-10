const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'meus_uploads', 'enare_completo.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const questions = JSON.parse(rawData);

const item13 = questions[13];
console.log('--- ITEM 13 ---');
console.log('Chaves:', Object.keys(item13));
console.log('Conteúdo:', JSON.stringify(item13, null, 2));
