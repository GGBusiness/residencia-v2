
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
        console.log('--- Seeding Corrected Questions ---');

        // 1. Ensure documents exist (Institution and Year are here)
        await pool.query(`
      INSERT INTO documents (title, institution, year, area, type, processed)
      VALUES 
      ('Simulado ENARE 2025', 'ENARE', 2025, 'Geral', 'PROVA', true),
      ('Residência USP 2024', 'USP', 2024, 'Geral', 'PROVA', true),
      ('UNICAMP 2024', 'UNICAMP', 2024, 'Geral', 'PROVA', true),
      ('SUS-SP 2024', 'SUS-SP', 2024, 'Geral', 'PROVA', true)
      ON CONFLICT (title) DO NOTHING
    `);

        const { rows: docs } = await pool.query('SELECT id, institution FROM documents');
        const docMap = {};
        docs.forEach(d => docMap[d.institution] = d.id);

        // 2. Seed questions (Area and content are here)
        const questions = [
            ['ENARE', 'Cirurgia', 'Abdomen Agudo', 'Paciente masculino, 35 anos, apresenta dor abdominal intensa em fossa ilíaca direita há 12 horas, acompanhada de náuseas e febre (38°C). Ao exame físico: sinal de Blumberg positivo. Qual o diagnóstico mais provável?', 'Apendicite aguda', 'Diverticulite aguda', 'Pancreatite aguda', 'Colecistite aguda', 'Obstrução intestinal', 'A'],
            ['USP', 'Clínica Médica', 'Endocrinologia', 'Paciente com glicemia de jejum de 135 mg/dL em duas ocasiões. Qual o diagnóstico?', 'Diabetes Mellitus', 'Glicemia de jejum alterada', 'Tolerância à glicose diminuída', 'Hipoglicemia reativa', 'Normal', 'A'],
            ['SUS-SP', 'Pediatria', 'Aleitamento', 'Até que idade é recomendado aleitamento materno exclusivo?', '6 meses', '4 meses', '1 ano', '2 anos', '3 meses', 'A'],
            ['UNICAMP', 'GO', 'Ginecologia', 'Mulher de 30 anos com sangramento uterino aumentado, útero aumentado de volume, regular, móvel. USG mostra útero de 14cm. Diagnóstico?', 'Leiomioma uterino', 'Adenomiose', 'Câncer de endométrio', 'Pólipo endometrial', 'Endometriose', 'A'],
            ['ENARE', 'Medicina Preventiva', 'Epidemiologia', 'Qual nível de prevenção corresponde ao rastreamento de câncer de mama por mamografia?', 'Prevenção primária', 'Prevenção secundária', 'Prevenção terciária', 'Prevenção quaternária', 'Prevenção quinternária', 'B']
        ];

        for (const q of questions) {
            const inst = q[0];
            const area = q[1];
            const docId = docMap[inst];
            if (!docId) continue;

            await pool.query(`
        INSERT INTO questions (document_id, area, subarea, stem, option_a, option_b, option_c, option_d, option_e, correct_option)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [docId, area, q[2], q[3], q[4], q[5], q[6], q[7], q[8], q[9]]);
        }

        console.log('✅ Seeding completed successfully!');

    } catch (err) {
        console.error('❌ Error Seeding:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
