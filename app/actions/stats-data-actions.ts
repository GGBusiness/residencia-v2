'use server';

import { query } from '@/lib/db';

/**
 * Busca notas de corte (cut_scores).
 * Opcionalmente filtra por lista de instituições.
 */
export async function getCutScoresAction(institutions?: string[]) {
    try {
        let sql = `SELECT * FROM cut_scores`;
        let params: any[] = [];

        if (institutions && institutions.length > 0) {
            const placeholders = institutions.map((_, i) => `$${i + 1}`).join(', ');
            sql += ` WHERE institution IN (${placeholders})`;
            params = institutions;
        }

        sql += ` ORDER BY institution ASC, area ASC`;

        const { rows } = await query(sql, params).catch(() => ({ rows: [] }));
        return { success: true, data: rows };
    } catch (error: any) {
        console.error('Error fetching cut scores:', error);
        return { success: true, data: [] }; // Return empty — table may not exist yet
    }
}
