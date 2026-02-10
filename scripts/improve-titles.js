// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase - USANDO SERVICE ROLE KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: Credenciais do Supabase não encontradas!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Função para melhorar o título
function improveTitle(originalTitle) {
    // Remover extensão .pdf
    let title = originalTitle.replace(/\.pdf$/i, '');

    // Remover caracteres extras no final (duplicados, espaços)
    title = title.replace(/\.pdf.*$/i, '');
    title = title.replace(/\s+/g, ' ').trim();

    // Padrões comuns e suas melhorias
    const patterns = [
        // ENARE
        {
            regex: /^(\d+)\s*-\s*Simulado Revalida INEP (\d{4})\s*-?\s*Estrategia Med$/i,
            format: (m) => `Simulado Revalida INEP ${m[2]} - Caderno ${m[1]}`
        },
        {
            regex: /ENARE[- ]?(\d{4})[- ]Objetiva[- ]?R1/i,
            format: (m) => `ENARE ${m[1]} - Prova Objetiva R1`
        },
        {
            regex: /ENARE[- ]?(\d{4})/i,
            format: (m) => `ENARE ${m[1]} - Prova Objetiva`
        },

        // USP
        {
            regex: /prova[- ]residencia[- ]medica[- ]usp[- ]sp[- ]r1[- ](\d{4})/i,
            format: (m) => `USP-SP ${m[1]} - Residência Médica R1`
        },
        {
            regex: /prova[- ]residencia[- ]medica[- ]usp[- ]sp[- ]cirurgia[- ]geral[- ](\d{4})/i,
            format: (m) => `USP-SP ${m[1]} - Cirurgia Geral`
        },
        {
            regex: /prova[- ]residencia[- ]medica[- ]usp[- ]sp[- ]r[- ]?mais[- ]?cm[- ](\d{4})/i,
            format: (m) => `USP-SP ${m[1]} - R+ Clínica Médica`
        },

        // UNICAMP
        {
            regex: /(?:prova|gabarito)[- ]residencia[- ]medica[- ]unicamp[- ]manha[- ]tarde[- ]r1[- ](\d{4})/i,
            format: (m) => `UNICAMP ${m[1]} - R1 (Manhã/Tarde)`
        },
        {
            regex: /(?:prova|gabarito)[- ]residencia[- ]medica[- ]unicamp[- ]r[- ]?cir[- ](\d{4})/i,
            format: (m) => `UNICAMP ${m[1]} - R Cirurgia`
        },
        {
            regex: /(?:prova|gabarito)[- ]residencia[- ]medica[- ]unicamp[- ]r[- ]?go[- ](\d{4})/i,
            format: (m) => `UNICAMP ${m[1]} - R Ginecologia e Obstetrícia`
        },
        {
            regex: /(?:prova|gabarito)[- ]residencia[- ]medica[- ]unicamp[- ]r[- ]?ped[- ](\d{4})/i,
            format: (m) => `UNICAMP ${m[1]} - R Pediatria`
        },
        {
            regex: /(?:prova|gabarito)[- ]residencia[- ]medica[- ]unicamp[- ]r[- ]?neuroped[- ](\d{4})/i,
            format: (m) => `UNICAMP ${m[1]} - R Neuropediatria`
        },
        {
            regex: /(?:prova|gabarito)[- ]residencia[- ]medica[- ]unicamp[- ]r3cm[- ](\d{4})/i,
            format: (m) => `UNICAMP ${m[1]} - R3 Clínica Médica`
        },

        // SUS-SP
        {
            regex: /SUS[- ]SP[- ](\d{4})[- ]Objetiva/i,
            format: (m) => `SUS-SP ${m[1]} - Prova Objetiva R1`
        },
        {
            regex: /SUS[- ]SP[- ]RCG[- ]SP[- ](\d{4})/i,
            format: (m) => `SUS-SP ${m[1]} - R Cirurgia Geral`
        },
        {
            regex: /SUS[- ]SP[- ]RCM[- ]SP[- ](\d{4})/i,
            format: (m) => `SUS-SP ${m[1]} - R Clínica Médica`
        },
        {
            regex: /SUS[- ]SP[- ]RPED[- ]SP[- ](\d{4})/i,
            format: (m) => `SUS-SP ${m[1]} - R Pediatria`
        },

        // UNESP
        {
            regex: /UNESP[- ]SP[- ](\d{4})[- ]Objetiva[- ]R1/i,
            format: (m) => `UNESP-SP ${m[1]} - Prova Objetiva R1`
        },
        {
            regex: /UNESP[- ]SP[- ](\d{4})[- ]Objetiva[- ]CM/i,
            format: (m) => `UNESP-SP ${m[1]} - Clínica Médica`
        },
        {
            regex: /UNESP[- ]SP[- ](\d{4})[- ]Objetiva[- ]CG/i,
            format: (m) => `UNESP-SP ${m[1]} - Cirurgia Geral`
        },

        // ISCMSP
        {
            regex: /ISCMSP[- ]SP[- ](\d{4})[- ]Objetiva(?:[- ]r[- ]cir)?$/i,
            format: (m) => `ISCMSP-SP ${m[1]} - R Cirurgia`
        },
        {
            regex: /ISCMSP[- ]SP[- ](\d{4})[- ]Objetiva[- ]r[- ]ped/i,
            format: (m) => `ISCMSP-SP ${m[1]} - R Pediatria`
        },
        {
            regex: /ISCMSP[- ]SP[- ](\d{4})[- ]Objetiva[- ]r3cm/i,
            format: (m) => `ISCMSP-SP ${m[1]} - R3 Clínica Médica`
        },
        {
            regex: /ISCMSP[- ]SP[- ](\d{4})[- ]Objetiva$/i,
            format: (m) => `ISCMSP-SP ${m[1]} - Prova Objetiva R1`
        },

        // UNIFESP
        {
            regex: /UNIFESP[- ](\d{4})[- ]Objetiva[- ](\d+)/i,
            format: (m) => `UNIFESP ${m[1]} - Prova Objetiva (Caderno ${m[2]})`
        },

        // PSU
        {
            regex: /PSU[- ](\d{4})[- ]Objetiva(?:\s*\(\d+\))?/i,
            format: (m) => `PSU ${m[1]} - Prova Objetiva`
        },
        {
            regex: /PSU[- ]MG[- ](\d+)?[- ]?(\d{4})[- ]Objetiva[- ]?(\d*)/i,
            format: (m) => {
                const fase = m[3] ? ` (Caderno ${m[3]})` : '';
                return `PSU-MG ${m[2]} - Prova Objetiva${fase}`;
            }
        },

        // UFRJ
        {
            regex: /UFRJ[- ](\d{4})[- ]Objetiva[- ]?(\d*)/i,
            format: (m) => {
                const caderno = m[2] ? ` (Caderno ${m[2]})` : '';
                return `UFRJ ${m[1]} - Prova Objetiva${caderno}`;
            }
        },

        // UFES
        {
            regex: /UFES[- ]ES[- ](\d{4})[- ]Objetiva/i,
            format: (m) => `UFES-ES ${m[1]} - Prova Objetiva`
        },

        // Simulados genéricos
        {
            regex: /SIMULADO\s+ENAMED\s+MEDCOF\s+TENDENCIAS/i,
            format: () => 'Simulado ENAMED - Tendências (MedCof)'
        },
        {
            regex: /SIMULADO\s+(\d+)\s+Intensivo\s+R1\s+ENARE\s+(\d{4})/i,
            format: (m) => `Simulado ${m[1]} - Intensivo R1 ENARE ${m[2]}`
        },
        {
            regex: /Simulados?\s+(\d+)\s+Intensivo\s+R1\s+ENARE\s+(\d{4})/i,
            format: (m) => `Simulado ${m[1]} - Intensivo R1 ENARE ${m[2]}`
        },

        // Questões
        {
            regex: /(\d+)[- ]QUESTOES/i,
            format: (m) => `Questões - Caderno ${m[1]}`
        },
        {
            regex: /(\d+)[- ]RESPOSTAS/i,
            format: (m) => `Respostas - Caderno ${m[1]}`
        },
    ];

    // Tentar aplicar padrões
    for (const pattern of patterns) {
        const match = title.match(pattern.regex);
        if (match) {
            return pattern.format(match);
        }
    }

    // Se não matchou nenhum padrão, fazer limpeza básica
    title = title
        .replace(/[_-]+/g, ' ')  // Substituir _ e - por espaços
        .replace(/\s+/g, ' ')     // Remover espaços duplicados
        .trim();

    // Capitalizar primeira letra de cada palavra importante
    const exceptions = ['de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o'];
    title = title.split(' ').map((word, index) => {
        if (index === 0 || !exceptions.includes(word.toLowerCase())) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word.toLowerCase();
    }).join(' ');

    return title;
}

// Função principal
async function main() {
    console.log('🚀 Iniciando melhoria de títulos...\n');

    // Buscar todos os documentos
    console.log('📋 Buscando documentos no banco...');
    const { data: documents, error: fetchError } = await supabase
        .from('documents')
        .select('id, title');

    if (fetchError) {
        console.error('❌ Erro ao buscar documentos:', fetchError);
        process.exit(1);
    }

    console.log(`✅ Encontrados ${documents.length} documentos\n`);

    // Processar cada documento
    let updated = 0;
    let unchanged = 0;

    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const newTitle = improveTitle(doc.title);

        if (newTitle !== doc.title) {
            console.log(`[${i + 1}/${documents.length}] 📝 Atualizando:`);
            console.log(`   Antes:  "${doc.title}"`);
            console.log(`   Depois: "${newTitle}"`);

            const { error: updateError } = await supabase
                .from('documents')
                .update({ title: newTitle })
                .eq('id', doc.id);

            if (updateError) {
                console.error(`   ❌ Erro: ${updateError.message}`);
            } else {
                console.log(`   ✅ Atualizado!\n`);
                updated++;
            }
        } else {
            unchanged++;
        }
    }

    console.log('\n=================================');
    console.log('📊 RESUMO');
    console.log('=================================');
    console.log(`✅ Títulos atualizados: ${updated}`);
    console.log(`➖ Sem alteração: ${unchanged}`);
    console.log(`📁 Total: ${documents.length}`);
    console.log('=================================\n');

    console.log('🎉 Processo concluído!');
}

// Executar
main().catch(console.error);
