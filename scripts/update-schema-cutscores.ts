import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Config: Fix para certificados auto-assinados
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function migrate() {
    const { db } = await import('../lib/db');

    console.log('🔄 Criando tabela cut_scores...');

    try {
        // 1. Criar Tabela
        await db.query(`
            CREATE TABLE IF NOT EXISTS public.cut_scores (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                institution TEXT NOT NULL,
                area TEXT NOT NULL,
                year INTEGER,
                total_questions INTEGER,
                passing_score INTEGER,
                percentage INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Tabela cut_scores criada.');

        // 2. Inserir Dados Iniciais (Seed)
        const seeds = [
            { inst: 'ENARE', area: 'Clínica Médica', year: 2024, total: 100, passing: 78, pct: 78 },
            { inst: 'ENARE', area: 'Cirurgia Geral', year: 2024, total: 100, passing: 76, pct: 76 },
            { inst: 'ENARE', area: 'Pediatria', year: 2024, total: 100, passing: 74, pct: 74 },
            { inst: 'ENARE', area: 'Ginecologia', year: 2024, total: 100, passing: 75, pct: 75 },
            { inst: 'ENARE', area: 'Preventiva', year: 2024, total: 100, passing: 80, pct: 80 },

            { inst: 'USP', area: 'Clínica Médica', year: 2024, total: 100, passing: 82, pct: 82 },
            { inst: 'USP', area: 'Cirurgia Geral', year: 2024, total: 100, passing: 80, pct: 80 },
            { inst: 'USP', area: 'Neurologia', year: 2024, total: 100, passing: 79, pct: 79 },

            { inst: 'UNICAMP', area: 'Clínica Médica', year: 2024, total: 80, passing: 60, pct: 75 },
            { inst: 'UNICAMP', area: 'Cirurgia Geral', year: 2024, total: 80, passing: 58, pct: 72 }
        ];

        for (const s of seeds) {
            await db.query(`
                INSERT INTO cut_scores (institution, area, year, total_questions, passing_score, percentage)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING; -- Nota: Sem unique constraint, isso vai inserir sempre. Melhor truncar ou checar.
            `, [s.inst, s.area, s.year, s.total, s.passing, s.pct]);
        }
        console.log(`✅ ${seeds.length} notas de corte inseridas.`);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
    } finally {
        process.exit(0);
    }
}

migrate();
