// Carregar variáveis de ambiente do .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase - USANDO SERVICE ROLE KEY para permissões totais!
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: Credenciais do Supabase não encontradas!');
    console.error('📋 Verifique se o arquivo .env.local existe e contém:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL=...');
    console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Pasta raiz onde estão os PDFs
const ROOT_FOLDER = 'c:\\Geral\\Alice\\Provas Antigas';

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

    // Extrair área
    if (upper.includes('-CM') || upper.includes('CLINICA')) {
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

// Função para fazer upload de um arquivo
async function uploadFile(fileInfo) {
    try {
        const { path: filePath, name, folder } = fileInfo;

        console.log(`📄 Processando: ${name}`);

        // Ler arquivo
        const fileBuffer = fs.readFileSync(filePath);

        // Nome único no storage
        const storagePath = `${Date.now()}-${name}`;

        // Upload para Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('provas')
            .upload(storagePath, fileBuffer, {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (uploadError) {
            console.error(`❌ Erro no upload: ${uploadError.message}`);
            return { success: false, error: uploadError.message };
        }

        // Obter URL pública
        const { data: urlData } = supabase.storage
            .from('provas')
            .getPublicUrl(storagePath);

        // Extrair metadados
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
            console.error(`❌ Erro no banco: ${dbError.message}`);
            return { success: false, error: dbError.message };
        }

        console.log(`✅ Importado com sucesso!`);
        return { success: true };

    } catch (error) {
        console.error(`❌ Erro geral: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Função principal
async function main() {
    console.log('🚀 Iniciando importação de PDFs...\n');
    console.log(`📂 Pasta raiz: ${ROOT_FOLDER}\n`);

    // Encontrar todos os PDFs
    console.log('🔍 Buscando arquivos PDF...');
    const pdfs = findAllPdfs(ROOT_FOLDER);
    console.log(`✅ Encontrados ${pdfs.length} arquivos PDF\n`);

    if (pdfs.length === 0) {
        console.log('❌ Nenhum PDF encontrado!');
        return;
    }

    // Perguntar confirmação
    console.log('📋 Arquivos que serão importados:');
    pdfs.slice(0, 10).forEach(pdf => console.log(`   - ${pdf.name}`));
    if (pdfs.length > 10) {
        console.log(`   ... e mais ${pdfs.length - 10} arquivos`);
    }
    console.log('');

    // Importar todos
    let success = 0;
    let failed = 0;

    for (let i = 0; i < pdfs.length; i++) {
        const pdf = pdfs[i];
        console.log(`\n[${i + 1}/${pdfs.length}] ${pdf.name}`);

        const result = await uploadFile(pdf);

        if (result.success) {
            success++;
        } else {
            failed++;
        }

        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n=================================');
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('=================================');
    console.log(`✅ Sucesso: ${success}`);
    console.log(`❌ Falhas: ${failed}`);
    console.log(`📁 Total: ${pdfs.length}`);
    console.log('=================================\n');
}

// Executar
main().catch(console.error);
