// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuração do Supabase - USANDO SERVICE ROLE KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: Credenciais do Supabase não encontradas!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Pasta raiz onde estão os PDFs
const ROOT_FOLDER = 'c:\\Geral\\Alice\\Provas Antigas';

// Função para gerar nome de arquivo válido e curto
function generateShortFilename(originalName) {
    // Remover .pdf do final
    let name = originalName.replace(/\.pdf$/i, '');

    // Limitar a 50 caracteres para segurança
    if (name.length > 50) {
        // Pegar os primeiros 45 caracteres e adicionar hash
        const hash = crypto.createHash('md5').update(name).digest('hex').substring(0, 5);
        name = name.substring(0, 45) + '-' + hash;
    }

    // Remover caracteres especiais problemáticos
    name = name.replace(/[^\w\s\-]/g, '');

    // Substituir espaços por hífens
    name = name.replace(/\s+/g, '-');

    // Remover hífens duplicados
    name = name.replace(/-+/g, '-');

    return name + '.pdf';
}

// Função para extrair metadados do nome do arquivo
function extractMetadata(filename, folderPath) {
    const metadata = {
        title: filename.replace('.pdf', ''),
        type: 'PROVA',
        year: null,
        institution: null,
        area: null,
        tags: [],
        has_answer_key: false,
    };

    const upper = filename.toUpperCase();

    // Extrair ano (2021-2026)
    const yearMatch = filename.match(/20(2[1-6])/);
    if (yearMatch) {
        metadata.year = parseInt(yearMatch[0]);
    }

    // Extrair instituição
    if (upper.includes('ENARE')) metadata.institution = 'ENARE';
    else if (upper.includes('USP')) metadata.institution = 'USP';
    else if (upper.includes('UNICAMP')) metadata.institution = 'UNICAMP';
    else if (upper.includes('UNIFESP')) metadata.institution = 'UNIFESP';
    else if (upper.includes('SUS')) metadata.institution = 'SUS-SP';
    else if (upper.includes('SIMULADO')) metadata.institution = 'Simulado';

    // Extrair área
    if (upper.includes('-CM') || upper.includes('CLINICA') || upper.includes('CLÍNICA')) {
        metadata.area = 'Clínica Médica';
    } else if (upper.includes('-CG') || upper.includes('CIRURGIA')) {
        metadata.area = 'Cirurgia';
    } else if (upper.includes('-GO') || upper.includes('GINECO')) {
        metadata.area = 'GO';
    } else if (upper.includes('-PED') || upper.includes('PEDIATRIA')) {
        metadata.area = 'Pediatria';
    } else if (upper.includes('PREVENTIVA')) {
        metadata.area = 'Preventiva';
    }

    // Detectar tipo
    if (upper.includes('SIMULADO')) {
        metadata.type = 'SIMULADO';
    } else if (upper.includes('QUESTOES') || upper.includes('QUESTÕES')) {
        metadata.type = 'QUESTOES';
    } else if (upper.includes('AULA') || upper.includes('APOSTILA')) {
        metadata.type = 'AULA';
    }

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

// Função recursiva para encontrar todos os PDFs
function findAllPdfs(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Ignorar pasta APP (onde está o projeto)
            if (file !== 'APP') {
                findAllPdfs(filePath, fileList);
            }
        } else if (file.toLowerCase().endsWith('.pdf')) {
            fileList.push({
                path: filePath,
                name: file,
                folder: dir,
            });
        }
    });

    return fileList;
}

// Função para verificar se arquivo já foi importado
async function isAlreadyImported(filename) {
    const { data, error } = await supabase
        .from('documents')
        .select('id')
        .ilike('title', `%${filename.replace('.pdf', '')}%`)
        .limit(1);

    if (error) return false;
    return data && data.length > 0;
}

// Função para fazer upload de um arquivo
async function uploadFile(fileInfo) {
    try {
        const { path: filePath, name, folder } = fileInfo;

        console.log(`📄 Processando: ${name}`);

        // Verificar se já foi importado
        const alreadyImported = await isAlreadyImported(name);
        if (alreadyImported) {
            console.log(`⏭️  Já importado anteriormente, pulando...\n`);
            return { success: true, skipped: true };
        }

        // Ler arquivo
        const fileBuffer = fs.readFileSync(filePath);

        // Nome curto e válido no storage
        const shortName = generateShortFilename(name);
        const storagePath = `${Date.now()}-${shortName}`;

        console.log(`   Nome original: ${name}`);
        console.log(`   Nome no storage: ${storagePath}`);

        // Upload para Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('provas')
            .upload(storagePath, fileBuffer, {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (uploadError) {
            console.error(`❌ Erro no upload: ${uploadError.message}\n`);
            return { success: false, error: uploadError.message };
        }

        // Obter URL pública
        const { data: urlData } = supabase.storage
            .from('provas')
            .getPublicUrl(storagePath);

        // Extrair metadados do nome ORIGINAL
        const metadata = extractMetadata(name, folder);

        // Inserir no banco de dados
        const { data: dbData, error: dbError } = await supabase
            .from('documents')
            .insert([
                {
                    ...metadata,
                    pdf_url: urlData.publicUrl,
                },
            ]);

        if (dbError) {
            console.error(`❌ Erro no banco: ${dbError.message}\n`);
            return { success: false, error: dbError.message };
        }

        console.log(`✅ Importado com sucesso!\n`);
        return { success: true };

    } catch (error) {
        console.error(`❌ Erro geral: ${error.message}\n`);
        return { success: false, error: error.message };
    }
}

// Função principal
async function main() {
    console.log('🚀 Iniciando importação dos PDFs restantes...\n');
    console.log(`📂 Pasta raiz: ${ROOT_FOLDER}\n`);

    // Encontrar todos os PDFs
    console.log('🔍 Buscando arquivos PDF...');
    const pdfs = findAllPdfs(ROOT_FOLDER);
    console.log(`✅ Encontrados ${pdfs.length} arquivos PDF total\n`);

    // Importar todos (os já importados serão pulados)
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < pdfs.length; i++) {
        const pdf = pdfs[i];
        console.log(`[${i + 1}/${pdfs.length}] ${pdf.name}`);

        const result = await uploadFile(pdf);

        if (result.skipped) {
            skipped++;
        } else if (result.success) {
            success++;
        } else {
            failed++;
        }

        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n=================================');
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('=================================');
    console.log(`✅ Novos importados: ${success}`);
    console.log(`⏭️  Já existiam: ${skipped}`);
    console.log(`❌ Falhas: ${failed}`);
    console.log(`📁 Total processado: ${pdfs.length}`);
    console.log('=================================\n');
}

// Executar
main().catch(console.error);
