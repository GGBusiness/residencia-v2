// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

// Configuração do Supabase - USANDO SERVICE ROLE KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: Credenciais do Supabase não encontradas!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Pasta raiz onde estão os arquivos
const ROOT_FOLDER = 'c:\\Geral\\Alice\\Provas Antigas';
const TEMP_EXTRACT_FOLDER = path.join(ROOT_FOLDER, '_temp_extracts');

// Estatísticas
const stats = {
    zips: { total: 0, extracted: 0, failed: 0 },
    pdfs: { total: 0, imported: 0, skipped: 0, failed: 0 },
    others: { total: 0, imported: 0, skipped: 0, failed: 0 }
};

// Função para gerar nome de arquivo válido e curto
function generateShortFilename(originalName) {
    let name = originalName.replace(/\.(pdf|mp4|avi|mov|docx|pptx)$/i, '');

    if (name.length > 50) {
        const hash = crypto.createHash('md5').update(name).digest('hex').substring(0, 5);
        name = name.substring(0, 45) + '-' + hash;
    }

    name = name.replace(/[^\w\s\-]/g, '');
    name = name.replace(/\s+/g, '-');
    name = name.replace(/-+/g, '-');

    return name;
}

// Função para detectar tipo de arquivo
function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();

    if (['.pdf'].includes(ext)) return { type: 'PROVA', contentType: 'application/pdf', bucket: 'provas' };
    if (['.mp4', '.avi', '.mov', '.mkv'].includes(ext)) return { type: 'AULA', contentType: 'video/mp4', bucket: 'videos' };
    if (['.docx', '.doc'].includes(ext)) return { type: 'AULA', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bucket: 'documents' };
    if (['.pptx', '.ppt'].includes(ext)) return { type: 'AULA', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', bucket: 'documents' };

    return null;
}

// Função para extrair metadados do nome do arquivo
function extractMetadata(filename, folderPath) {
    const metadata = {
        title: filename.replace(/\.(pdf|mp4|avi|mov|docx|pptx)$/i, ''),
        type: 'PROVA',
        year: null,
        institution: null,
        area: null,
        tags: [],
        has_answer_key: false,
    };

    const upper = filename.toUpperCase();

    // Extrair ano
    const yearMatch = filename.match(/20(2[1-6])/);
    if (yearMatch) {
        metadata.year = parseInt(yearMatch[0]);
    }

    // Extrair instituição
    if (upper.includes('ENARE')) metadata.institution = 'ENARE';
    else if (upper.includes('USP')) metadata.institution = 'USP';
    else if (upper.includes('UNICAMP')) metadata.institution = 'UNICAMP';
    else if (upper.includes('MEDCOF')) metadata.institution = 'MedCof';
    else if (upper.includes('ESTRATEGIA')) metadata.institution = 'Estratégia Med';

    // Extrair área
    if (upper.includes('CM') || upper.includes('CLINICA')) metadata.area = 'Clínica Médica';
    else if (upper.includes('CG') || upper.includes('CIRURGIA')) metadata.area = 'Cirurgia';
    else if (upper.includes('GO') || upper.includes('GINECO')) metadata.area = 'GO';
    else if (upper.includes('PED') || upper.includes('PEDIATRIA')) metadata.area = 'Pediatria';
    else if (upper.includes('NEURO')) metadata.area = 'Neurologia';

    // Detectar tipo
    if (upper.includes('SIMULADO')) metadata.type = 'SIMULADO';
    else if (upper.includes('QUESTOES') || upper.includes('QUESTÕES')) metadata.type = 'QUESTOES';
    else if (upper.includes('AULA') || upper.includes('APOSTILA')) metadata.type = 'AULA';

    // Tags da pasta
    const folderName = path.basename(folderPath);
    if (folderName !== 'Provas Antigas') {
        metadata.tags.push(folderName);
    }

    // Detectar gabarito
    if (upper.includes('GABARITO') || upper.includes('RESPOSTA')) {
        metadata.has_answer_key = true;
    }

    return metadata;
}

// Função para verificar se arquivo já foi importado
async function isAlreadyImported(title) {
    const { data, error } = await supabase
        .from('documents')
        .select('id')
        .eq('title', title)
        .limit(1);

    if (error) return false;
    return data && data.length > 0;
}

// Função para fazer upload de um arquivo
async function uploadFile(filePath, originalFolder) {
    try {
        const fileName = path.basename(filePath);
        const fileInfo = getFileType(fileName);

        if (!fileInfo) {
            console.log(`⏭️  Tipo não suportado: ${fileName}\n`);
            stats.others.skipped++;
            return { success: true, skipped: true };
        }

        // Extrair metadados
        const metadata = extractMetadata(fileName, originalFolder);

        // Verificar se já foi importado
        const alreadyImported = await isAlreadyImported(metadata.title);
        if (alreadyImported) {
            console.log(`⏭️  Já existe: ${metadata.title}\n`);
            if (fileInfo.type === 'PROVA') stats.pdfs.skipped++;
            else stats.others.skipped++;
            return { success: true, skipped: true };
        }

        console.log(`📄 Importando: ${metadata.title}`);

        // Ler arquivo
        const fileBuffer = fs.readFileSync(filePath);

        // Nome curto e válido no storage
        const shortName = generateShortFilename(fileName);
        const ext = path.extname(fileName);
        const storagePath = `${Date.now()}-${shortName}${ext}`;

        // Upload para Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(fileInfo.bucket)
            .upload(storagePath, fileBuffer, {
                contentType: fileInfo.contentType,
                upsert: false,
            });

        if (uploadError) {
            console.error(`❌ Erro no upload: ${uploadError.message}\n`);
            if (fileInfo.type === 'PROVA') stats.pdfs.failed++;
            else stats.others.failed++;
            return { success: false, error: uploadError.message };
        }

        // Obter URL pública
        const { data: urlData } = supabase.storage
            .from(fileInfo.bucket)
            .getPublicUrl(storagePath);

        // Inserir no banco de dados
        const { data: dbData, error: dbError } = await supabase
            .from('documents')
            .insert([
                {
                    ...metadata,
                    type: fileInfo.type,
                    pdf_url: urlData.publicUrl,
                },
            ]);

        if (dbError) {
            console.error(`❌ Erro no banco: ${dbError.message}\n`);
            if (fileInfo.type === 'PROVA') stats.pdfs.failed++;
            else stats.others.failed++;
            return { success: false, error: dbError.message };
        }

        console.log(`✅ Importado!\n`);
        if (fileInfo.type === 'PROVA') stats.pdfs.imported++;
        else stats.others.imported++;

        return { success: true };

    } catch (error) {
        console.error(`❌ Erro geral: ${error.message}\n`);
        return { success: false, error: error.message };
    }
}

// Função para extrair ZIP
function extractZip(zipPath, extractTo) {
    try {
        console.log(`📦 Extraindo: ${path.basename(zipPath)}`);
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractTo, true);
        stats.zips.extracted++;
        console.log(`✅ Extraído para: ${extractTo}\n`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao extrair: ${error.message}\n`);
        stats.zips.failed++;
        return false;
    }
}

// Função recursiva para encontrar todos os arquivos
function findFiles(dir, fileList = [], typeFilter = null) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file !== 'APP' && file !== '_temp_extracts' && file !== 'node_modules') {
                findFiles(filePath, fileList, typeFilter);
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            if (!typeFilter || typeFilter.includes(ext)) {
                fileList.push({ path: filePath, name: file, folder: dir });
            }
        }
    });

    return fileList;
}

// Função principal
async function main() {
    console.log('🚀 Importação Completa de Conteúdo\n');
    console.log(`📂 Pasta raiz: ${ROOT_FOLDER}\n`);

    // Criar pasta temporária para extrações
    if (!fs.existsSync(TEMP_EXTRACT_FOLDER)) {
        fs.mkdirSync(TEMP_EXTRACT_FOLDER, { recursive: true });
    }

    // 1. Encontrar e extrair ZIPs
    console.log('='.repeat(50));
    console.log('📦 FASE 1: EXTRAINDO ARQUIVOS ZIP');
    console.log('='.repeat(50) + '\n');

    const zips = findFiles(ROOT_FOLDER, [], ['.zip']);
    stats.zips.total = zips.length;
    console.log(`✅ Encontrados ${zips.length} arquivos ZIP\n`);

    for (const zip of zips) {
        const extractPath = path.join(TEMP_EXTRACT_FOLDER, path.basename(zip.name, '.zip'));
        extractZip(zip.path, extractPath);
    }

    // 2. Importar PDFs (da pasta raiz + extraídos)
    console.log('\n' + '='.repeat(50));
    console.log('📄 FASE 2: IMPORTANDO PDFs');
    console.log('='.repeat(50) + '\n');

    const pdfs = findFiles(ROOT_FOLDER, [], ['.pdf']);
    stats.pdfs.total = pdfs.length;
    console.log(`✅ Encontrados ${pdfs.length} arquivos PDF\n`);

    for (let i = 0; i < pdfs.length; i++) {
        console.log(`[${i + 1}/${pdfs.length}]`);
        await uploadFile(pdfs[i].path, pdfs[i].folder);
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 3. Importar outros arquivos
    console.log('\n' + '='.repeat(50));
    console.log('📚 FASE 3: IMPORTANDO OUTROS ARQUIVOS');
    console.log('='.repeat(50) + '\n');

    const others = findFiles(ROOT_FOLDER, [], ['.mp4', '.avi', '.mov', '.docx', '.pptx']);
    stats.others.total = others.length;
    console.log(`✅ Encontrados ${others.length} outros arquivos\n`);

    for (let i = 0; i < others.length; i++) {
        console.log(`[${i + 1}/${others.length}]`);
        await uploadFile(others[i].path, others[i].folder);
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    //  Limpar pasta temporária
    console.log('\n🧹 Limpando arquivos temporários...');
    if (fs.existsSync(TEMP_EXTRACT_FOLDER)) {
        fs.rmSync(TEMP_EXTRACT_FOLDER, { recursive: true, force: true });
    }

    // Resumo final
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO FINAL');
    console.log('='.repeat(50));
    console.log(`\n📦 ZIPs:`);
    console.log(`   Total: ${stats.zips.total}`);
    console.log(`   ✅ Extraídos: ${stats.zips.extracted}`);
    console.log(`   ❌ Falhas: ${stats.zips.failed}`);

    console.log(`\n📄 PDFs:`);
    console.log(`   Total: ${stats.pdfs.total}`);
    console.log(`   ✅ Importados: ${stats.pdfs.imported}`);
    console.log(`   ⏭️  Já existiam: ${stats.pdfs.skipped}`);
    console.log(`   ❌ Falhas: ${stats.pdfs.failed}`);

    console.log(`\n📚 Outros Arquivos:`);
    console.log(`   Total: ${stats.others.total}`);
    console.log(`   ✅ Importados: ${stats.others.imported}`);
    console.log(`   ⏭️  Já existiam/Não suportados: ${stats.others.skipped}`);
    console.log(`   ❌ Falhas: ${stats.others.failed}`);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Importação Concluída!');
    console.log('='.repeat(50) + '\n');
}

// Executar
main().catch(console.error);
