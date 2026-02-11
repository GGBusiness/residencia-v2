
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
        console.log('--- Seeding Questions ---');

        // Check if we have documents. We need documents to link questions.
        const docRes = await pool.query('SELECT id, institution FROM documents LIMIT 5');
        if (docRes.rows.length === 0) {
            console.log('No documents found in DB. Seeding sample documents first...');
            await pool.query(`
        INSERT INTO documents (title, institution, year, area, type, processed)
        VALUES 
        ('Simulado ENARE 2025', 'ENARE', 2025, 'Geral', 'PROVA', true),
        ('Residência USP 2024', 'USP', 2024, 'Geral', 'PROVA', true),
        ('UNICAMP 2024', 'UNICAMP', 2024, 'Geral', 'PROVA', true),
        ('SUS-SP 2024', 'SUS-SP', 2024, 'Geral', 'PROVA', true)
        ON CONFLICT DO NOTHING
      `);
        }

        const { rows: docs } = await pool.query('SELECT id, institution FROM documents');
        const docMap = {};
        docs.forEach(d => docMap[d.institution] = d.id);

        console.log('Documents available for:', Object.keys(docMap));

        // Seed questions
        const questions = [
            ['ENARE', 2025, 'Cirurgia', 'Abdomen Agudo', 'media', 'Paciente masculino, 35 anos, apresenta dor abdominal intensa em fossa ilíaca direita há 12 horas, acompanhada de náuseas e febre (38°C). Ao exame físico: sinal de Blumberg positivo. Qual o diagnóstico mais provável?', 'Apendicite aguda', 'Diverticulite aguda', 'Pancreatite aguda', 'Colecistite aguda', 'Obstrução intestinal', 'A'],
            ['USP', 2024, 'Clínica Médica', 'Endocrinologia', 'facil', 'Paciente com glicemia de jejum de 135 mg/dL em duas ocasiões. Qual o diagnóstico?', 'Diabetes Mellitus', 'Glicemia de jejum alterada', 'Tolerância à glicose diminuída', 'Hipoglicemia reativa', 'Normal', 'A'],
            ['SUS-SP', 2024, 'Pediatria', 'Aleitamento', 'facil', 'Até que idade é recomendado aleitamento materno exclusivo?', '6 meses', '4 meses', '1 ano', '2 anos', '3 meses', 'A'],
            ['UNICAMP', 2024, 'GO', 'Ginecologia', 'media', 'Mulher de 30 anos com sangramento uterino aumentado, útero aumentado de volume, regular, móvel. USG mostra útero de 14cm. Diagnóstico?', 'Leiomioma uterino', 'Adenomiose', 'Câncer de endométrio', 'Pólipo endometrial', 'Endometriose', 'A'],
            ['ENARE', 2025, 'Medicina Preventiva', 'Epidemiologia', 'facil', 'Qual nível de prevenção corresponde ao rastreamento de câncer de mama por mamografia?', 'Prevenção primária', 'Prevenção secundária', 'Prevenção terciária', 'Prevenção quaternária', 'Prevenção quinternária', 'B']
        ];

        for (const q of questions) {
            const docId = docMap[q[0]] || (docs.length > 0 ? docs[0].id : null);
            if (!docId) continue;

            await pool.query(`
        INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, document_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT DO NOTHING
      `, [...q, docId]);
        }

        console.log('✅ Seeding completed!');

    } catch (err) {
        console.error('❌ Error Seeding:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
