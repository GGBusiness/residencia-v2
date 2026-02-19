
import { query } from './db';

// ─── Tipos ────────────────────────────────────────────────
interface StudentProfile {
    user_id: string;
    target_institution: string;
    target_specialty: string;
    exam_timeframe: string;
    weekly_hours: number;
    has_attempted_before: boolean;
    theoretical_base: string;
    best_study_time: string;
}

interface SlotDef {
    start: string;
    end: string;
    type: 'study' | 'review' | 'exam';
    suffix: string;
    durationMinutes: number;
}

// ─── Horários base por turno ─────────────────────────────
// Cada turno define blocos de 1.5h que podem ser combinados
const TIME_BLOCKS: Record<string, { start: string; blockMinutes: number }[]> = {
    'manha': [
        { start: '06:00', blockMinutes: 90 },
        { start: '07:30', blockMinutes: 90 },
        { start: '09:00', blockMinutes: 90 },
        { start: '10:30', blockMinutes: 90 },
    ],
    'tarde': [
        { start: '13:00', blockMinutes: 90 },
        { start: '14:30', blockMinutes: 90 },
        { start: '16:00', blockMinutes: 90 },
        { start: '17:30', blockMinutes: 90 },
    ],
    'noite': [
        { start: '18:30', blockMinutes: 90 },
        { start: '20:00', blockMinutes: 90 },
        { start: '21:30', blockMinutes: 90 },
    ],
    'madrugada': [
        { start: '22:00', blockMinutes: 90 },
        { start: '23:30', blockMinutes: 90 },
        { start: '01:00', blockMinutes: 90 },
    ],
    'variavel': [
        { start: '08:00', blockMinutes: 90 },
        { start: '09:30', blockMinutes: 90 },
        { start: '14:00', blockMinutes: 90 },
        { start: '15:30', blockMinutes: 90 },
        { start: '19:00', blockMinutes: 90 },
        { start: '20:30', blockMinutes: 90 },
    ],
};

// ─── Helpers ─────────────────────────────────────────────
function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function escapeSQL(str: string): string {
    return str.replace(/'/g, "''");
}

// ─── Lógica de Personalização ────────────────────────────
function buildDailySlots(profile: StudentProfile): SlotDef[] {
    const studyDays = 6; // Seg–Sáb (Dom = folga, Sáb = simulado separado)
    const dailyMinutes = Math.round((profile.weekly_hours / studyDays) * 60);

    // Pegar blocos do turno preferido
    const availableBlocks = TIME_BLOCKS[profile.best_study_time] || TIME_BLOCKS['noite'];

    // Quantos blocos de 90min cabem nas horas diárias?
    const maxBlocks = Math.min(
        Math.ceil(dailyMinutes / 90),
        availableBlocks.length
    );
    const blocksToUse = Math.max(1, maxBlocks); // Mínimo 1 bloco

    // Distribuição Estudo vs Revisão baseada na base teórica
    let studyRatio = 0.5; // 50% estudo, 50% revisão
    switch (profile.theoretical_base) {
        case 'fraca': studyRatio = 0.70; break; // Mais teoria
        case 'media': studyRatio = 0.50; break;
        case 'boa': studyRatio = 0.35; break; // Mais prática
        case 'excelente': studyRatio = 0.20; break; // Quase só prática
    }

    // Ajuste por urgência do exame
    if (profile.exam_timeframe === 'menos_3_meses') {
        studyRatio = Math.max(0.15, studyRatio - 0.15); // Mais prática quando urgente
    } else if (profile.exam_timeframe === 'mais_1_ano') {
        studyRatio = Math.min(0.80, studyRatio + 0.10); // Mais teoria quando há tempo
    }

    const studyBlocks = Math.max(1, Math.round(blocksToUse * studyRatio));
    const reviewBlocks = Math.max(1, blocksToUse - studyBlocks);

    const slots: SlotDef[] = [];

    // Montar slots de Estudo
    for (let i = 0; i < studyBlocks && i < availableBlocks.length; i++) {
        const block = availableBlocks[i];
        slots.push({
            start: block.start,
            end: addMinutes(block.start, block.blockMinutes),
            type: 'study',
            suffix: 'Estudo',
            durationMinutes: block.blockMinutes,
        });
    }

    // Montar slots de Revisão
    for (let i = studyBlocks; i < studyBlocks + reviewBlocks && i < availableBlocks.length; i++) {
        const block = availableBlocks[i];
        slots.push({
            start: block.start,
            end: addMinutes(block.start, block.blockMinutes),
            type: 'review',
            suffix: 'Revisão',
            durationMinutes: block.blockMinutes,
        });
    }

    return slots;
}

// ─── Geração do Cronograma ──────────────────────────────
export async function generateWeeklySchedule(userId: string, clientDate?: string) {
    try {
        console.log('🚀 [Planner] Generating personalized schedule for:', userId);

        // 1. Buscar perfil completo do estudante
        const { rows: profiles } = await query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
        const profile: StudentProfile = profiles[0] || {
            user_id: userId,
            target_institution: 'ENARE',
            target_specialty: 'Clínica Médica',
            exam_timeframe: '3_6_meses',
            weekly_hours: 20,
            has_attempted_before: false,
            theoretical_base: 'media',
            best_study_time: 'noite',
        };

        console.log('📋 [Planner] Profile:', JSON.stringify({
            institution: profile.target_institution,
            specialty: profile.target_specialty,
            hours: profile.weekly_hours,
            time: profile.best_study_time,
            base: profile.theoretical_base,
            timeframe: profile.exam_timeframe,
        }));

        // 2. Calcular slots personalizados para este estudante
        const dailySlots = buildDailySlots(profile);
        console.log(`📐 [Planner] ${dailySlots.length} sessions/day: ${dailySlots.map(s => s.suffix).join(', ')}`);

        // 3. Limpar eventos futuros não completados
        const anchorDateStr = clientDate || new Date().toLocaleDateString('en-CA');
        await query('DELETE FROM study_events WHERE user_id = $1 AND date >= $2 AND completed = FALSE', [userId, anchorDateStr]);

        // 4. Definir rotação de áreas PONDERADA pelo desempenho
        const target = profile.target_specialty || 'Clínica Médica';
        const allAreas = ['Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia e Obstetrícia', 'Medicina Preventiva'];

        // Buscar desempenho por área
        // Buscar desempenho por área (com fallback para erro de coluna)
        let performanceRows: any[] = [];
        try {
            const { rows } = await query(`
                SELECT 
                    a.config->>'area' as area,
                    AVG(a.percentage) as avg_percentage,
                    COUNT(*) as attempt_count
                FROM attempts a
                WHERE a.user_id = $1 AND a.status = 'COMPLETED' AND a.percentage IS NOT NULL
                GROUP BY a.config->>'area'
            `, [userId]);
            performanceRows = rows;
        } catch (err) {
            console.warn('⚠️ [Planner] Failed to fetch performance stats (using defaults):', err);
            // Fallback: empty performance, will result in default weights
        }

        // Buscar nota de corte média da instituição-alvo
        const { rows: cutRows } = await query(
            `SELECT AVG(percentage) as avg_cut FROM cut_scores WHERE institution = $1`,
            [profile.target_institution]
        );
        const targetCut = Number(cutRows[0]?.avg_cut || 70);

        // Calcular peso de cada área (áreas fracas = mais peso)
        const perfMap: Record<string, number> = {};
        performanceRows.forEach((r: any) => {
            if (r.area) perfMap[r.area] = Number(r.avg_percentage);
        });

        const areaWeights: { area: string; weight: number }[] = allAreas.map(area => {
            const perf = perfMap[area];
            const isTarget = area.toLowerCase().trim() === target.toLowerCase().trim();

            if (perf === undefined) {
                // No data → high priority (needs practice)
                return { area, weight: isTarget ? 4 : 3 };
            }

            const gap = targetCut - perf; // Positive = below cut score
            let weight: number;

            if (gap > 20) weight = 5;       // Very weak: 5 days/cycle
            else if (gap > 10) weight = 4;  // Weak: 4 days
            else if (gap > 0) weight = 3;   // Below target: 3 days
            else if (gap > -10) weight = 2; // At target: 2 days
            else weight = 1;                // Above target: 1 day (maintenance)

            // Boost target specialty slightly
            if (isTarget) weight = Math.max(weight, 2);

            return { area, weight };
        });

        // Build weighted area rotation list
        const weightedAreas: string[] = [];
        areaWeights.forEach(({ area, weight }) => {
            for (let i = 0; i < weight; i++) {
                weightedAreas.push(area);
            }
        });

        // Shuffle for variety (but keep deterministic per user)
        const shuffled = weightedAreas.sort((a, b) => {
            // Interleave areas so same area doesn't repeat consecutively
            return a.localeCompare(b);
        });
        // Better interleave: distribute evenly
        const interleaved: string[] = [];
        const buckets: Record<string, number> = {};
        shuffled.forEach(a => { buckets[a] = (buckets[a] || 0) + 1; });
        const maxBucket = Math.max(...Object.values(buckets));
        for (let round = 0; round < maxBucket; round++) {
            for (const area of allAreas) {
                if ((buckets[area] || 0) > round) {
                    interleaved.push(area);
                }
            }
        }

        console.log(`🎯 [Planner] Area weights: ${areaWeights.map(a => `${a.area}=${a.weight}`).join(', ')}`);
        console.log(`📊 [Planner] Cycle length: ${interleaved.length} days, distribution: ${JSON.stringify(buckets)}`);

        // 5. Intensidade baseada na urgência
        let totalDays = 31;
        if (profile.exam_timeframe === 'menos_3_meses') totalDays = 31;
        if (profile.exam_timeframe === 'mais_1_ano') totalDays = 28;

        // 6. Gerar os dias
        const values: string[] = [];
        const baseDateString = clientDate || new Date().toLocaleDateString('en-CA');
        const baseDate = new Date(baseDateString + 'T12:00:00');
        let weekdayIndex = 0; // Track only weekdays for area cycling

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentDay = new Date(baseDate);
            currentDay.setDate(baseDate.getDate() + dayOffset);
            const dateStr = currentDay.toLocaleDateString('en-CA');
            const dayOfWeek = currentDay.getDay();

            // Domingo = folga
            if (dayOfWeek === 0) continue;

            // Sábado = Simulado personalizado
            if (dayOfWeek === 6) {
                const inst = escapeSQL(profile.target_institution);
                const simDuration = profile.weekly_hours >= 30 ? 4 : 3;
                const simEnd = addMinutes('08:00', simDuration * 60);
                values.push(`('${userId}', 'Simulado ${inst}', 'exam', 'Geral', '${dateStr}', '08:00', '${simEnd}', FALSE)`);
                values.push(`('${userId}', 'Revisão dos Erros', 'review', 'Geral', '${dateStr}', '14:00', '16:00', FALSE)`);

                if (profile.weekly_hours >= 35) {
                    values.push(`('${userId}', 'Estudo Dirigido: ${escapeSQL(target)}', 'study', '${escapeSQL(target)}', '${dateStr}', '16:30', '18:00', FALSE)`);
                }
                continue;
            }

            // Dias de semana: Usar área ponderada do ciclo
            const area = interleaved[weekdayIndex % interleaved.length];
            weekdayIndex++;
            const safeArea = escapeSQL(area);

            dailySlots.forEach(slot => {
                const title = `${slot.suffix}: ${safeArea}`;
                values.push(`('${userId}', '${title}', '${slot.type}', '${safeArea}', '${dateStr}', '${slot.start}', '${slot.end}', FALSE)`);
            });
        }

        if (values.length === 0) return { success: true, count: 0 };

        // 7. Inserir tudo de uma vez
        const sql = `
            INSERT INTO study_events (user_id, title, event_type, area, date, start_time, end_time, completed)
            VALUES ${values.join(', ')}
        `;
        await query(sql);

        console.log(`✅ [Planner] Created ${values.length} personalized sessions`);
        console.log(`   📊 Daily: ${dailySlots.length} sessions, ~${Math.round(profile.weekly_hours / 6)}h/day`);
        console.log(`   📚 Study ratio: ${dailySlots.filter(s => s.suffix === 'Estudo').length} study / ${dailySlots.filter(s => s.suffix === 'Revisão').length} review`);

        return { success: true, count: values.length, start: anchorDateStr };

    } catch (error: any) {
        console.error('❌ [Planner] Error:', error);
        return { success: false, error: error.message };
    }
}

// ─── Plano do Dia ───────────────────────────────────────
export async function getDailyPlan(userId: string, clientDate?: string) {
    try {
        const today = clientDate || new Date().toLocaleDateString('en-CA');
        const { rows } = await query(`
            SELECT * FROM study_events 
            WHERE user_id = $1 
            AND date = $2
            ORDER BY start_time ASC
        `, [userId, today]);

        if (rows.length === 0) return null;

        const firstSession = rows[0];
        const { rows: profiles } = await query(
            'SELECT target_institution, target_specialty, theoretical_base, exam_timeframe FROM user_profiles WHERE user_id = $1',
            [userId]
        );
        const profile = profiles[0] || { target_institution: 'ENARE', target_specialty: 'Clínica Médica' };

        // Mensagem personalizada baseada no perfil
        let message = `Hoje o foco é em ${firstSession.area || profile.target_specialty}.`;
        if (profile.exam_timeframe === 'menos_3_meses') {
            message += ' A prova está próxima — cada sessão conta! 🔥';
        } else if (profile.theoretical_base === 'fraca') {
            message += ' Foque nos fundamentos para construir uma base sólida. 📚';
        } else if (profile.theoretical_base === 'excelente') {
            message += ' Use esse tempo para treinar questões de alta complexidade. 🎯';
        } else {
            message += ' Prepare-se para dominar este tema! 💪';
        }

        return {
            focusArea: firstSession.area || profile.target_specialty,
            message,
            recommendedConfig: {
                institution: profile.target_institution,
                area: firstSession.area || profile.target_specialty,
                questionCount: profile.exam_timeframe === 'menos_3_meses' ? 30 : 15,
                mode: 'PROVA'
            },
            sessions: rows
        };
    } catch (error: any) {
        console.error('Error fetching daily plan:', error);
        return null;
    }
}
