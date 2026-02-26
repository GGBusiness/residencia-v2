'use server';

import { query } from '@/lib/db';

export async function setupAdminSchemaAction() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS api_usage_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                provider VARCHAR(50) NOT NULL,
                model VARCHAR(100) NOT NULL,
                tokens_input INTEGER DEFAULT 0,
                tokens_output INTEGER DEFAULT 0,
                cost_usd DECIMAL(10, 6) DEFAULT 0,
                context VARCHAR(255), 
                user_id UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_logs(created_at);
        `);

        return { success: true, message: 'Tabela de logs criada com sucesso.' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAdminStatsAction() {
    try {
        // 1. Basic Counts — ALL from DigitalOcean
        const { rows: [{ count: userCount }] } = await query(
            "SELECT COUNT(*) as count FROM profiles"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 2. New Users Today
        const today = new Date().toISOString().split('T')[0];
        const { rows: [{ count: newUsersToday }] } = await query(
            "SELECT COUNT(*) as count FROM profiles WHERE created_at >= $1",
            [today]
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 3. Activity Today (Attempts)
        const { rows: [{ count: attemptsToday }] } = await query(
            "SELECT COUNT(*) as count FROM attempts WHERE started_at >= $1",
            [today]
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 4. Content Stats
        const { rows: [{ count: totalQuestions }] } = await query(
            "SELECT COUNT(*) as count FROM questions"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 5. Documents Stats
        const { rows: [{ count: totalDocuments }] } = await query(
            "SELECT COUNT(*) as count FROM documents"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 6. Embeddings Stats
        const { rows: [{ count: totalEmbeddings }] } = await query(
            "SELECT COUNT(*) as count FROM document_embeddings"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 6b. AI-Generated Questions Count
        const { rows: [{ count: aiQuestionsCount }] } = await query(
            "SELECT COUNT(*) as count FROM questions q JOIN documents d ON q.document_id = d.id WHERE d.title = 'AI-Generated Questions'"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 7. Top Institutions
        const { rows: topInstitutions } = await query(`
            SELECT institution as name, COUNT(*) as usage_count
            FROM documents 
            WHERE institution IS NOT NULL
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 5
        `).catch(() => ({ rows: [] }));

        // 8. Top Areas
        const { rows: topAreas } = await query(`
            SELECT area, COUNT(*) as count
            FROM questions
            WHERE area IS NOT NULL
            GROUP BY 1
            ORDER BY 2 DESC 
            LIMIT 5
        `).catch(() => ({ rows: [] }));

        // 9. Top Specialties from profiles target
        const { rows: topSpecialties } = await query(`
             SELECT goal as specialty, COUNT(*) as count
             FROM profiles
             WHERE goal IS NOT NULL
             GROUP BY 1
             ORDER BY 2 DESC
             LIMIT 5
        `).catch(() => ({ rows: [] }));

        return {
            success: true,
            data: {
                users: { total: parseInt(userCount) || 0, newToday: parseInt(newUsersToday) || 0 }, // FIXED: changed newUsersToday to newToday to match frontend (stats?.users?.newToday)
                activity: { attemptsToday: parseInt(attemptsToday) || 0 },
                content: {
                    totalQuestions: parseInt(totalQuestions) || 0,
                    aiQuestions: parseInt(aiQuestionsCount) || 0,
                    totalDocuments: parseInt(totalDocuments) || 0,
                    totalEmbeddings: parseInt(totalEmbeddings) || 0
                },
                analytics: {
                    topInstitutions,
                    topAreas,
                    topSpecialties
                }
            }
        };

    } catch (error: any) {
        console.error('Admin Stats Error:', error);
        return { success: false, error: error.message };
    }
}

export async function getAdminCostsAction() {
    try {
        const { rows: data } = await query(`
            SELECT cost_usd, tokens_input, tokens_output, provider, created_at
            FROM api_usage_logs
            ORDER BY created_at DESC
            LIMIT 100
        `).catch(() => ({ rows: [] }));

        const totalCost = data.reduce((acc: number, curr: any) => acc + (Number(curr.cost_usd) || 0), 0);

        return {
            success: true,
            data: {
                history: data,
                totalCost
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// === VERIFICAÇÃO DE SINCRONIZAÇÃO DO BANCO ===
export async function verifyDbSyncAction() {
    console.log('🔍 [DB-SYNC] Iniciando verificação de integridade...');
    const issues: string[] = [];
    const fixes: string[] = [];

    try {
        // 1. Questões órfãs (sem documento associado)
        const { rows: orphanedQuestions } = await query(`
            SELECT q.id, q.stem FROM questions q
            LEFT JOIN documents d ON q.document_id = d.id
            WHERE d.id IS NULL
        `);
        if (orphanedQuestions.length > 0) {
            issues.push(`${orphanedQuestions.length} questões órfãs (sem documento)`);
            // Auto-fix: deletar questões órfãs
            await query(`
                DELETE FROM questions WHERE id IN (
                    SELECT q.id FROM questions q
                    LEFT JOIN documents d ON q.document_id = d.id
                    WHERE d.id IS NULL
                )
            `);
            fixes.push(`Deletadas ${orphanedQuestions.length} questões órfãs`);
        }

        // 2. Embeddings órfãos (sem documento)
        const { rows: orphanedEmbeddings } = await query(`
            SELECT de.id FROM document_embeddings de
            LEFT JOIN documents d ON de.document_id = d.id
            WHERE d.id IS NULL
        `);
        if (orphanedEmbeddings.length > 0) {
            issues.push(`${orphanedEmbeddings.length} embeddings órfãos (sem documento)`);
            await query(`
                DELETE FROM document_embeddings WHERE id IN (
                    SELECT de.id FROM document_embeddings de
                    LEFT JOIN documents d ON de.document_id = d.id
                    WHERE d.id IS NULL
                )
            `);
            fixes.push(`Deletados ${orphanedEmbeddings.length} embeddings órfãos`);
        }

        // 3. Documentos sem questões nem embeddings
        const { rows: emptyDocs } = await query(`
            SELECT d.id, d.title FROM documents d
            WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.document_id = d.id)
              AND NOT EXISTS (SELECT 1 FROM document_embeddings de WHERE de.document_id = d.id)
        `);
        if (emptyDocs.length > 0) {
            issues.push(`${emptyDocs.length} documentos vazios (sem questões/embeddings)`);
            await query(`
                DELETE FROM documents WHERE id IN (
                    SELECT d.id FROM documents d
                    WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.document_id = d.id)
                      AND NOT EXISTS (SELECT 1 FROM document_embeddings de WHERE de.document_id = d.id)
                )
            `);
            fixes.push(`Deletados ${emptyDocs.length} documentos vazios`);
        }

        // 4. Questões com problemas de qualidade
        const { rows: badQuestions } = await query(`
            SELECT id, stem, option_a, option_b, option_c, option_d, option_e
            FROM questions
            WHERE LENGTH(stem) < 30
               OR option_a IS NULL OR option_b IS NULL OR option_c IS NULL OR option_d IS NULL
               OR LOWER(option_a) = LOWER(option_b) OR LOWER(option_a) = LOWER(option_c)
               OR LOWER(option_b) = LOWER(option_c) OR LOWER(option_a) = LOWER(option_d)
               OR LOWER(option_b) = LOWER(option_d) OR LOWER(option_c) = LOWER(option_d)
        `);
        if (badQuestions.length > 0) {
            issues.push(`${badQuestions.length} questões com problemas de qualidade (enunciado curto ou alternativas idênticas)`);
        }

        // 5. Contagens gerais
        const { rows: [counts] } = await query(`
            SELECT
                (SELECT COUNT(*) FROM documents) as docs,
                (SELECT COUNT(*) FROM questions) as questions,
                (SELECT COUNT(*) FROM document_embeddings) as embeddings,
                (SELECT COUNT(*) FROM profiles) as users
        `);

        const summary = {
            documents: parseInt(counts.docs),
            questions: parseInt(counts.questions),
            embeddings: parseInt(counts.embeddings),
            users: parseInt(counts.users),
        };

        console.log(`✅ [DB-SYNC] Verificação concluída. Issues: ${issues.length}, Fixes: ${fixes.length}`);

        return {
            success: true,
            healthy: issues.length === 0 && fixes.length === 0,
            summary,
            issues,
            fixes,
            badQuestionsCount: badQuestions.length,
        };

    } catch (error: any) {
        console.error('❌ [DB-SYNC] Erro:', error.message);
        return { success: false, error: error.message };
    }
}

// === FETCH INGESTED DOCUMENTS ===
export async function getIngestedDocumentsAction() {
    try {
        const { rows } = await query(`
            SELECT d.id, d.title, d.institution, d.year, d.created_at, 
                   COUNT(q.id) as question_count
            FROM documents d
            LEFT JOIN questions q ON q.document_id = d.id
            GROUP BY d.id
            ORDER BY d.created_at DESC
            LIMIT 50
        `);

        // Also get the total count of documents
        const { rows: totalResult } = await query('SELECT COUNT(*) as count FROM documents');
        const total = parseInt(totalResult[0]?.count || '0', 10);

        return { success: true, data: rows, total };
    } catch (error: any) {
        console.error('Error fetching ingested documents:', error);
        return { success: false, error: error.message };
    }
}
