
import { db, query } from './db';

// Mapeamento de horários
const TIME_RANGES = {
    'manha': { start: '08:00', end: '11:00' },
    'tarde': { start: '14:00', end: '17:00' },
    'noite': { start: '19:00', end: '22:00' },
    'madrugada': { start: '23:00', end: '02:00' },
    'variavel': { start: '20:00', end: '23:00' }, // Default fallback
};

export async function generateWeeklySchedule(userId: string) {
    try {
        console.log('📅 [Planner Service] Generating schedule for:', userId);

        // 1. Get User Profile & Goals
        const { rows: profiles } = await query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);

        let profile = profiles[0];
        if (!profile) {
            console.warn('⚠️ [Planner Service] Profile not found. Creating default profile...');
            // Create a default profile to avoid crashing
            profile = {
                user_id: userId,
                target_institution: 'ENARE',
                target_specialty: 'Clínica Médica',
                weekly_hours: 20,
                best_study_time: 'noite'
            };
        } else {
            console.log('👤 [Planner Service] Profile found:', profile.target_institution, profile.target_specialty);
        }

        const { rows: goals } = await query('SELECT * FROM user_goals WHERE user_id = $1', [userId]);
        const goal = goals[0] || { weekly_hours_goal: 20 };
        console.log('🎯 [Planner Service] Goal hours:', goal.weekly_hours_goal);

        // 2. Clear existing future events
        // (Optional: for now we append, but usually we should clear future uncompleted events)

        // 3. Calculate sessions
        const weeklyHours = goal.weekly_hours_goal || 20;
        const bestTime = TIME_RANGES[profile.best_study_time as keyof typeof TIME_RANGES] || TIME_RANGES['noite'];

        // Rotatividade de Matérias
        const rotation = [
            profile.target_specialty || 'Clínica Médica',
            'Cirurgia Geral',
            'Pediatria',
            'Ginecologia e Obstetrícia',
            'Medicina Preventiva',
            'Cirurgia Geral',
            'Clínica Médica'
        ];

        let eventsToInsert = [];
        let today = new Date();

        console.log('🗓️ [Planner Service] Calculating events for next 4 weeks...');

        // Generate for next 4 weeks
        for (let week = 0; week < 4; week++) {
            for (let day = 0; day < 7; day++) {
                let currentDay = new Date(today);
                currentDay.setDate(today.getDate() + (week * 7) + day);

                const dayOfWeek = currentDay.getDay(); // 0 = Sun, 6 = Sat

                // Skip weekends for study (Saturday is Review)
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    if (dayOfWeek === 6) {
                        eventsToInsert.push({
                            user_id: userId,
                            title: 'Revisão Semanal',
                            event_type: 'review',
                            area: 'Geral', // Ensure area is not null
                            date: currentDay.toISOString().split('T')[0],
                            start_time: '10:00',
                            end_time: '12:00',
                            completed: false
                        });
                    }
                    continue;
                }

                // Create Study Session
                const subject = rotation[(week * 5 + day) % rotation.length];

                eventsToInsert.push({
                    user_id: userId,
                    title: `Estudo: ${subject}`,
                    area: subject,
                    event_type: 'study',
                    date: currentDay.toISOString().split('T')[0],
                    start_time: bestTime.start,
                    end_time: bestTime.end,
                    completed: false
                });
            }
        }

        console.log(`💾 [Planner Service] Inserting ${eventsToInsert.length} events...`);

        // 4. Batch Insert
        let insertedCount = 0;
        for (const event of eventsToInsert) {
            try {
                await query(`
                    INSERT INTO study_events (user_id, title, event_type, area, date, start_time, end_time, completed)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [event.user_id, event.title, event.event_type, event.area, event.date, event.start_time, event.end_time, event.completed]);
                insertedCount++;
            } catch (err) {
                console.error(`❌ [Planner Service] Failed to insert event ${event.title}:`, err);
            }
        }

        console.log(`✅ [Planner Service] Successfully inserted ${insertedCount} events.`);
        return { success: true, count: insertedCount };

    } catch (error: any) {
        console.error('❌ [Planner Service] Critical Error:', error);
        return { success: false, error: error.message };
    }
}

export async function getDailyPlan(userId: string) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { rows } = await query(`
            SELECT * FROM study_events 
            WHERE user_id = $1 
            AND date = $2
            ORDER BY start_time ASC
        `, [userId, today]);

        return rows;
    } catch (error: any) {
        console.error('Error fetching daily plan:', error);
        return [];
    }
}
