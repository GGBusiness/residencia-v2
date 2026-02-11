
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DIGITALOCEAN_DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function seed() {
    try {
        console.log('--- Safe Seeding Questions ---');

        const docsToSeed = [
            { title: 'Simulado ENARE 2025', institution: 'ENARE', year: 2025, area: 'Geral', type: 'PROVA', processed: true },
            { title: 'Residência USP 2024', institution: 'USP', year: 2024, area: 'Geral', type: 'PROVA', processed: true },
            { title: 'UNICAMP 2024', institution: 'UNICAMP', year: 2024, area: 'Geral', type: 'PROVA', processed: true },
            { title: 'SUS-SP 2024', institution: 'SUS-SP', year: 2024, area: 'Geral', type: 'PROVA', processed: true }
        ];

        for (const doc of docsToSeed) {
            const checkRes = await pool.query('SELECT id FROM documents WHERE title = $1', [doc.title]);
            if (checkRes.rows.length === 0) {
                await pool.query(
                    'INSERT INTO documents (title, institution, year, area, type, processed) VALUES ($1, $2, $3, $4, $5, $6)',
                    [doc.title, doc.institution, doc.year, doc.area, doc.type, doc.processed]
                );
                console.log(`+ Added document: ${doc.title}`);
            }
        }

        const { rows: docs } = await pool.query('SELECT id, institution FROM documents');
        const docMap = {};
        docs.forEach(d => docMap[d.institution] = d.id);

        const questions = [
            { inst: 'ENARE', area: 'Cirurgia', subarea: 'Abdomen Agudo', stem: 'Paciente masculino, 35 anos, apresenta dor abdominal intensa em fossa ilíaca direita há 12 horas, acompanhada de náuseas e febre (38°C). Ao exame físico: sinal de Blumberg positivo. Qual o diagnóstico mais provável?', a: 'Apendicite aguda', b: 'Diverticulite aguda', c: 'Pancreatite aguda', d: 'Colecistite aguda', e: 'Obstrução intestinal', correct: 'A' },
            { inst: 'USP', area: 'Clínica Médica', subarea: 'Endocrinologia', stem: 'Paciente com glicemia de jejum de 135 mg/dL em duas ocasiões. Qual o diagnóstico?', a: 'Diabetes Mellitus', b: 'Glicemia de jejum alterada', c: 'Tolerância à glicose diminuída', d: 'Hipoglicemia reativa', e: 'Normal', correct: 'A' },
            { inst: 'SUS-SP', area: 'Pediatria', subarea: 'Aleitamento', stem: 'Até que idade é recomendado aleitamento materno exclusivo?', a: '6 meses', b: '4 meses', c: '1 ano', d: '2 anos', e: '3 meses', correct: 'A' },
            { inst: 'UNICAMP', area: 'GO', subarea: 'Ginecologia', stem: 'Mulher de 30 anos com sangramento uterino aumentado, útero aumentado de volume, regular, móvel. USG mostra útero de 14cm. Diagnóstico?', a: 'Leiomioma uterino', b: 'Adenomiose', c: 'Câncer de endométrio', p: 'Pólipo endometrial', e: 'Endometriose', correct: 'A' },
            { inst: 'ENARE', area: 'Medicina Preventiva', subarea: 'Epidemiologia', stem: 'Qual nível de prevenção corresponde ao rastreamento de câncer de mama por mamografia?', a: 'Prevenção primária', b: 'Prevenção secundária', c: 'Prevenção terciária', d: 'Prevenção quaternária', e: 'Prevenção quinternária', correct: 'B' }
        ];

        for (const q of questions) {
            const docId = docMap[q.inst];
            if (!docId) continue;

            const qCheck = await pool.query('SELECT id FROM questions WHERE stem = $1', [q.stem]);
            if (qCheck.rows.length === 0) {
                await pool.query(`
          INSERT INTO questions (document_id, area, subarea, stem, option_a, option_b, option_c, option_d, option_e, correct_option)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [docId, q.area, q.subarea, q.stem, q.a, q.b, q.c, q.d, q.e, q.correct]);
                console.log(`+ Added question for: ${q.area}`);
            }
        }

        console.log('✅ Seeding completed!');

    } catch (err) {
        console.error('❌ Error Seeding:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
