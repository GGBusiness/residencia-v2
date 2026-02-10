
import { query } from '@/lib/db';
import { calculateNextReview, ReviewRating } from '@/lib/fsrs';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase'; // Only for Auth

export async function POST(req: Request) {
    try {
        const supabase = createServerClient();

        // Check Auth
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { questionId, rating } = body;

        if (!questionId || !rating) {
            return new NextResponse('Missing fields', { status: 400 });
        }

        const numericRating = Number(rating) as ReviewRating;
        if (![1, 2, 3, 4].includes(numericRating)) {
            return new NextResponse('Invalid rating', { status: 400 });
        }

        // 1. Get Current Progress
        const { rows: progressRows } = await query(
            'SELECT * FROM user_question_progress WHERE user_id = $1 AND question_id = $2',
            [session.user.id, questionId]
        );
        const currentProgress = progressRows[0];

        // 2. Calculate New State
        const newState = calculateNextReview(currentProgress || undefined, numericRating);

        // 3. Save to DB
        // Upsert logic
        await query(`
            INSERT INTO user_question_progress (
                user_id, question_id, stability, difficulty, repetition_count,
                last_review_at, next_review_at, state, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (user_id, question_id) DO UPDATE SET
                stability = EXCLUDED.stability,
                difficulty = EXCLUDED.difficulty,
                repetition_count = EXCLUDED.repetition_count,
                last_review_at = EXCLUDED.last_review_at,
                next_review_at = EXCLUDED.next_review_at,
                state = EXCLUDED.state,
                updated_at = NOW()
        `, [
            session.user.id,
            questionId,
            newState.stability,
            newState.difficulty,
            newState.repetition_count,
            newState.last_review_at,
            newState.next_review_at,
            newState.state
        ]);

        return NextResponse.json({
            success: true,
            next_review: newState.next_review_at,
            interval_days: newState.stability
        });

    } catch (error) {
        console.error('Review API Error:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
