import { query } from '../lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface QuestionRow {
    id: string;
    stem: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    option_e: string | null;
    correct_option: string;
    explanation: string;
    area: string;
    document_id: string;
}

/**
 * Identifica questões com problemas e usa GPT-4o para consertá-las.
 * - Enunciados cortados → GPT reconstrói o enunciado completo
 * - Alternativas similares → GPT reescreve alternativas distintas
 * - Alternativas faltando → GPT gera alternativas
 * - Enunciados curtos → GPT expande
 */
async function fixQuestions() {
    console.log('\n🔧 === CORREÇÃO AUTOMÁTICA DE QUESTÕES ===\n');

    const { rows: allQuestions } = await query(`
        SELECT id, stem, option_a, option_b, option_c, option_d, option_e, 
               correct_option, explanation, area, document_id
        FROM questions ORDER BY created_at DESC
    `) as { rows: QuestionRow[] };

    console.log(`Total de questões no banco: ${allQuestions.length}`);

    // Identificar questões com problemas
    const toFix: { question: QuestionRow; reason: string; similarInfo?: string }[] = [];

    for (const q of allQuestions) {
        const stem = q.stem || '';

        // 1. Stem curto
        if (stem.length < 30) {
            toFix.push({ question: q, reason: 'ENUNCIADO_CURTO' });
            continue;
        }

        // 2. Stem cortado (começa com minúscula e não é número)
        const firstChar = stem.trim()[0];
        if (firstChar && firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase() && !/^\d/.test(stem.trim())) {
            toFix.push({ question: q, reason: 'ENUNCIADO_CORTADO' });
            continue;
        }

        // 3. Alternativas faltando
        if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) {
            toFix.push({ question: q, reason: 'ALTERNATIVAS_FALTANDO' });
            continue;
        }

        // 4. Alternativas similares
        const allOpts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
            .filter(Boolean)
            .map((o: string) => o.toLowerCase().trim().replace(/[.,;:!?]+$/, ''));
        const optLabels = ['A', 'B', 'C', 'D', 'E'];

        let hasDuplicate = false;
        let similarPairs: string[] = [];
        for (let i = 0; i < allOpts.length; i++) {
            for (let j = i + 1; j < allOpts.length; j++) {
                if (allOpts[i] === allOpts[j]) { hasDuplicate = true; similarPairs.push(`${optLabels[i]} e ${optLabels[j]} são IDÊNTICAS`); break; }
                const shorter = allOpts[i].length < allOpts[j].length ? allOpts[i] : allOpts[j];
                const longer = allOpts[i].length >= allOpts[j].length ? allOpts[i] : allOpts[j];
                if (shorter.length > 10 && longer.includes(shorter.substring(0, Math.floor(shorter.length * 0.8)))) {
                    hasDuplicate = true;
                    similarPairs.push(`${optLabels[i]} e ${optLabels[j]} compartilham >80% do texto`);
                    break;
                }
            }
            if (hasDuplicate) break;
        }
        if (hasDuplicate) {
            toFix.push({ question: q, reason: 'ALTERNATIVAS_SIMILARES', similarInfo: similarPairs.join('; ') });
        }
    }

    console.log(`\n📊 Questões para corrigir: ${toFix.length}`);

    if (toFix.length === 0) {
        console.log('✅ Todas as questões estão OK!');
        process.exit(0);
    }

    // Agrupar por tipo
    const byReason: Record<string, number> = {};
    for (const item of toFix) {
        byReason[item.reason] = (byReason[item.reason] || 0) + 1;
    }
    for (const [reason, count] of Object.entries(byReason)) {
        console.log(`   ${reason}: ${count}`);
    }

    // Buscar contexto dos documentos (embeddings) para ajudar o GPT
    const docContextCache: Record<string, string> = {};

    async function getDocContext(docId: string): Promise<string> {
        if (docContextCache[docId]) return docContextCache[docId];
        try {
            const { rows } = await query(
                `SELECT content FROM document_embeddings WHERE document_id = $1 ORDER BY id LIMIT 3`,
                [docId]
            );
            const ctx = rows.map((r: any) => r.content).join('\n\n');
            docContextCache[docId] = ctx.substring(0, 8000); // Limitar contexto
            return docContextCache[docId];
        } catch {
            return '';
        }
    }

    // Processar 1 questão por vez para máxima qualidade
    const BATCH_SIZE = 1;
    let fixedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toFix.length; i += BATCH_SIZE) {
        const batch = toFix.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(toFix.length / BATCH_SIZE);

        console.log(`\n🔄 Processando batch ${batchNum}/${totalBatches} (${batch.length} questões)...`);

        // Buscar contexto do primeiro documento no batch
        const docId = batch[0].question.document_id;
        const docContext = await getDocContext(docId);

        const questionsForGPT = batch.map((item, idx) => ({
            index: idx,
            id: item.question.id,
            problem: item.reason,
            stem: item.question.stem,
            option_a: item.question.option_a,
            option_b: item.question.option_b,
            option_c: item.question.option_c,
            option_d: item.question.option_d,
            option_e: item.question.option_e,
            correct_option: item.question.correct_option,
            explanation: item.question.explanation,
            area: item.question.area,
            similar_pairs: item.similarInfo || 'N/A',
        }));

        const prompt = `Você é um especialista em questões de residência médica.
Preciso que CONSERTE as questões abaixo que têm problemas de qualidade.

PROBLEMAS POSSÍVEIS:
- ENUNCIADO_CORTADO: O enunciado começa no meio de uma frase. Reconstrua o enunciado completo usando o contexto do documento e as alternativas como pista do tema.
- ENUNCIADO_CURTO: O enunciado é muito curto. Expanda com contexto clínico adequado.
- ALTERNATIVAS_SIMILARES: Duas ou mais alternativas são muito parecidas. Você DEVE reescrever COMPLETAMENTE as alternativas para que sejam totalmente diferentes.
  ATENÇÃO: Alternativas são "similares" quando compartilham mais de 80% do texto. Exemplo:
    RUIM: "ressonância magnética com gadolínio para caracterização" vs "ressonância magnética com gadolínio para melhor caracterização"
    BOM: "ressonância magnética com gadolínio" vs "tomografia computadorizada com contraste" vs "ultrassonografia abdominal"
  A alternativa CORRETA deve manter o sentido médico correto. As INCORRETAS devem ser plausíveis mas claramente diferentes.
  Se duas alternativas têm conteúdo parecido, SUBSTITUA uma delas por uma alternativa médica completamente diferente.
- ALTERNATIVAS_FALTANDO: Algumas alternativas estão vazias. Gere alternativas médicas plausíveis.

REGRAS CRÍTICAS:
- Mantenha o gabarito correto (correct_option) o mesmo.
- O stem deve SEMPRE começar com letra maiúscula.
- CADA alternativa deve usar vocabulário e conceitos DIFERENTES das outras.
- NÃO basta trocar uma palavra — reescreva o conteúdo inteiro da alternativa se necessário.

CONTEXTO DO DOCUMENTO (texto original do PDF):
${docContext.substring(0, 6000)}

QUESTÕES PARA CONSERTAR:
${JSON.stringify(questionsForGPT, null, 2)}

Retorne um JSON com o formato:
{
    "fixed_questions": [
        {
            "index": 0,
            "stem": "Enunciado completo consertado...",
            "option_a": "Alternativa A (DIFERENTE de B,C,D,E)",
            "option_b": "Alternativa B (DIFERENTE de A,C,D,E)",
            "option_c": "Alternativa C (DIFERENTE de A,B,D,E)",
            "option_d": "Alternativa D (DIFERENTE de A,B,C,E)",
            "option_e": "Alternativa E (DIFERENTE de A,B,C,D)" ou null,
            "correct_option": "B",
            "explanation": "Explicação detalhada...",
            "area": "Área médica"
        }
    ]
}`;

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'Você conserta questões de residência médica. Foco em tornar CADA alternativa completamente diferente das outras. Retorne APENAS JSON válido.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.5,
            });

            const content = completion.choices[0].message.content;
            const parsed = JSON.parse(content || '{}');
            const fixedQuestions = parsed.fixed_questions || [];

            for (const fixed of fixedQuestions) {
                const originalItem = batch[fixed.index];
                if (!originalItem) continue;

                const newStem = fixed.stem || originalItem.question.stem;
                const newOptA = fixed.option_a || originalItem.question.option_a;
                const newOptB = fixed.option_b || originalItem.question.option_b;
                const newOptC = fixed.option_c || originalItem.question.option_c;
                const newOptD = fixed.option_d || originalItem.question.option_d;
                const newOptE = fixed.option_e || originalItem.question.option_e;
                const newCorrect = fixed.correct_option || originalItem.question.correct_option;
                const newExplanation = fixed.explanation || originalItem.question.explanation;
                const newArea = fixed.area || originalItem.question.area;

                // Validar antes de salvar
                if (!newStem || newStem.length < 20) {
                    console.log(`   ⚠️ Skip: stem ainda muito curto`);
                    errorCount++;
                    continue;
                }

                await query(`
                    UPDATE questions 
                    SET stem = $1, option_a = $2, option_b = $3, option_c = $4, 
                        option_d = $5, option_e = $6, correct_option = $7, 
                        explanation = $8, area = $9
                    WHERE id = $10
                `, [
                    newStem, newOptA, newOptB, newOptC, newOptD, newOptE,
                    newCorrect, newExplanation, newArea, originalItem.question.id
                ]);

                fixedCount++;
            }

            console.log(`   ✅ ${fixedQuestions.length} questões consertadas neste batch`);

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (err: any) {
            console.error(`   ❌ Erro no batch ${batchNum}:`, err.message);
            errorCount += batch.length;
        }
    }

    console.log(`\n🏁 === RESULTADO FINAL ===`);
    console.log(`   ✅ Consertadas: ${fixedCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log(`   📊 Total processadas: ${toFix.length}\n`);

    process.exit(0);
}

fixQuestions().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
