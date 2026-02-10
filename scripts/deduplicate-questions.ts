// Script para remover duplicatas no banco de dados
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Precisa ser a chave de serviço para deletar

if (!supabaseKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY necessária para deduplicação!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deduplicate() {
    console.log('🚀 Iniciando deduplicação de questões...');

    // 1. Buscar todas as questões (apenas id e texto)
    // Supabase limita a 1000 por request, precisamos paginar
    let allQuestions: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('questions')
            .select('id, question_text')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('❌ Erro ao buscar questões:', error.message);
            return;
        }

        if (!data || data.length === 0) break;

        allQuestions = allQuestions.concat(data);
        process.stdout.write(`\r📥 Carregadas: ${allQuestions.length}`);

        if (data.length < pageSize) break;
        page++;
    }
    console.log('\n✅ Total carregado:', allQuestions.length);

    // 2. Identificar duplicatas
    const seenText = new Map<string, string>(); // texto -> id (do primeiro encontrado)
    const duplicates: string[] = []; // ids para remover

    for (const q of allQuestions) {
        // Normalizar texto (remover espaços extras, lowercase)
        if (!q.question_text) continue;
        const normalized = q.question_text.trim().toLowerCase();

        if (seenText.has(normalized)) {
            duplicates.push(q.id);
        } else {
            seenText.set(normalized, q.id);
        }
    }

    console.log(`🔍 Duplicatas encontradas: ${duplicates.length}`);

    if (duplicates.length === 0) {
        console.log('✨ Nenhuma duplicata encontrada!');
        return;
    }

    // 3. Remover duplicatas em lotes
    console.log('🗑️ Removendo duplicatas...');
    let deleted = 0;
    const batchSize = 100;

    for (let i = 0; i < duplicates.length; i += batchSize) {
        const batch = duplicates.slice(i, i + batchSize);
        const { error } = await supabase
            .from('questions')
            .delete()
            .in('id', batch);

        if (error) {
            console.error(`❌ Erro ao deletar lote ${i}:`, error.message);
        } else {
            deleted += batch.length;
            process.stdout.write(`\r🗑️ Removidas: ${deleted}/${duplicates.length}`);
        }
    }

    console.log('\n✅ Deduplicação concluída!');

    // Verificar contagem final
    const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

    console.log(`📈 Total atual no banco: ${count}`);
}

deduplicate().catch(console.error);
