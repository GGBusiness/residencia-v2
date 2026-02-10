import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 1. Carregar variáveis de ambiente ANTES de qualquer outro import interno
dotenv.config({ path: '.env.local' });

// Config: Fix para certificados auto-assinados (DB)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Definições de Tipo
interface FileMetadata {
    title: string;
    type: string;
    year: number | null;
    institution: string | null;
    area: string | null;
    tags: string[];
    has_answer_key: boolean;
}

// Pasta Raiz
const ROOT_FOLDER = 'c:\\Geral\\Alice\\Provas Antigas';

function extractMetadata(filename: string, folderPath: string): FileMetadata {
    const metadata: FileMetadata = {
        title: filename.replace('.pdf', ''),
        type: 'PROVA',
        year: null,
        institution: null,
        area: null,
        tags: [],
        has_answer_key: false,
    };

    const upper = filename.toUpperCase();

    // Ano
    const yearMatch = filename.match(/20(2[1-6])/);
    if (yearMatch) metadata.year = parseInt(yearMatch[0]);

    // Instituição
    if (upper.includes('ENARE')) metadata.institution = 'ENARE';
    else if (upper.includes('USP')) metadata.institution = 'USP';
    else if (upper.includes('UNICAMP')) metadata.institution = 'UNICAMP';
    else if (upper.includes('UNIFESP')) metadata.institution = 'UNIFESP';
    else if (upper.includes('SUS')) metadata.institution = 'SUS-SP';
    else if (upper.includes('UFRJ')) metadata.institution = 'UFRJ';
    else if (upper.includes('UFES')) metadata.institution = 'UFES';
    else if (upper.includes('PSU')) metadata.institution = 'PSU-MG';

    // Área
    if (upper.includes('-CM') || upper.includes('CLINICA')) metadata.area = 'Clínica Médica';
    else if (upper.includes('-CG') || upper.includes('CIRURGIA')) metadata.area = 'Cirurgia';
    else if (upper.includes('-GO') || upper.includes('GINECO')) metadata.area = 'GO';
    else if (upper.includes('-PED') || upper.includes('PEDIATRIA')) metadata.area = 'Pediatria';
    else if (upper.includes('PREVENTIVA')) metadata.area = 'Preventiva';

    // Tipo
    if (upper.includes('SIMULADO')) metadata.type = 'SIMULADO';
    else if (upper.includes('QUESTOES') || upper.includes('QUESTÕES')) metadata.type = 'QUESTOES';
    else if (upper.includes('AULA') || upper.includes('APOSTILA')) metadata.type = 'AULA';

    // Tags
    const folderName = path.basename(folderPath);
    if (folderName !== 'Provas Antigas') metadata.tags.push(folderName);

    // Gabarito
    if (upper.includes('GABARITO') || upper.includes('RESPOSTA')) metadata.has_answer_key = true;

    return metadata;
}

function findAllPdfs(dir: string, fileList: { path: string; name: string; folder: string }[] = []) {
    try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                if (!file.includes('node_modules') && !file.includes('.git') && file !== 'APP') {
                    findAllPdfs(filePath, fileList);
                }
            } else if (file.toLowerCase().endsWith('.pdf')) {
                fileList.push({ path: filePath, name: file, folder: dir });
            }
        });
    } catch (e) { }
    return fileList;
}

async function main() {
    console.log('☁️  SEEDER: Inicializando...');

    // 2. Importação Dinâmica (Só agora carregamos módulos que usam process.env)
    const { storageService } = await import('../lib/storage');
    const { db } = await import('../lib/db');

    console.log('🔍 Escaneando diretórios...');
    const allFiles = findAllPdfs(ROOT_FOLDER);
    console.log(`📂 Encontrados ${allFiles.length} PDFs locais.`);

    // Filtro simplificado para teste (remove se quiser dnovo)
    const priorityFiles = allFiles.filter(f => {
        const name = f.name.toLowerCase();
        return name.includes('enare') || name.includes('usp') || name.includes('unicamp') || name.includes('2024');
    });

    console.log(`🎯 Selecionados ${priorityFiles.length} arquivos para processar.`);

    let uploadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of priorityFiles) {
        // console.log(`\n📄 Processando: ${file.name}`);

        try {
            // Check DB
            const checkRes = await db.query('SELECT id FROM documents WHERE title = $1', [file.name.replace('.pdf', '')]);
            if ((checkRes.rowCount ?? 0) > 0) {
                process.stdout.write('.'); // Dot progress for skips
                skippedCount++;
                continue;
            } else {
                process.stdout.write('\n↑'); // Newline for uploads
            }

            console.log(` Enviando: ${file.name}`);
            const fileBuffer = fs.readFileSync(file.path);
            const spacesPath = `provas/${file.name}`; // Folder 'provas'

            // Upload
            const publicUrl = await storageService.uploadFile(fileBuffer, spacesPath, 'application/pdf');

            // Metadata
            const meta = extractMetadata(file.name, file.folder);

            // DB Insert
            await db.query(
                `INSERT INTO documents (
                    title, type, year, program, institution, area, 
                    tags, has_answer_key, pdf_url, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    meta.title, meta.type, meta.year, null, meta.institution,
                    meta.area, meta.tags, meta.has_answer_key, publicUrl, {}
                ]
            );
            console.log(`   ✅ OK`);
            uploadedCount++;

        } catch (err: any) {
            console.error(`\n❌ Falha em ${file.name}: ${err.message}`);
            errorCount++;
        }
    }

    console.log('\n\n=============================================');
    console.log(`📊 RESUMO FINAL`);
    console.log(`✅ Uploads Novos: ${uploadedCount}`);
    console.log(`⏭️  Pulados (Já existiam): ${skippedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log('=============================================\n');
    process.exit(0);
}

main();
