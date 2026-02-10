const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'import-enare_completo.sql');
const outputDir = path.join(__dirname, '..', 'sql_chunks');

if (!fs.existsSync(inputFile)) {
    console.error('❌ Arquivo SQL não encontrado!');
    process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

console.log('🚀 Dividindo SQL em partes menores...\n');

const content = fs.readFileSync(inputFile, 'utf8');
const statements = content.split('INSERT INTO').filter(s => s.trim().length > 0);

console.log(`📊 Total de instruções INSERT: ${statements.length}`);

const CHUNK_SIZE = 100;
let fileCount = 0;

for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    const chunk = statements.slice(i, i + CHUNK_SIZE);
    fileCount++;

    let sqlContent = `-- Parte ${fileCount}\n`;
    sqlContent += chunk.map(s => 'INSERT INTO ' + s).join('');

    const fileName = `import_part_${String(fileCount).padStart(3, '0')}.sql`;
    fs.writeFileSync(path.join(outputDir, fileName), sqlContent);

    console.log(`   💾 Gerado: ${fileName} (${chunk.length} questões)`);
}

console.log(`\n✅ Concluído! ${fileCount} arquivos gerados na pasta "sql_chunks".`);
console.log('👉 Importe um por um no Supabase para evitar erro de tamanho.');
