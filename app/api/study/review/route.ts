
import { createServerClient } from '@/lib/supabase';
import { calculateNextReview, ReviewRating } from '@/lib/fsrs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
        const { data: currentProgress } = await supabase
            .from('user_question_progress')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('question_id', questionId)
            .single();

        // 2. Calculate New State
        const newState = calculateNextReview(currentProgress, numericRating);

        // 3. Save to DB
        // We use upsert to handle both insert (new) and update (existing)
        const { error } = await supabase
            .from('user_question_progress')
            .upsert({
                user_id: session.user.id,
                question_id: questionId,
                stability: newState.stability,
                difficulty: newState.difficulty,
                repetition_count: newState.repetition_count,
                last_review_at: newState.last_review_at.toISOString(),
                next_review_at: newState.next_review_at.toISOString(),
                state: newState.state,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, question_id' });

        if (error) {
            console.error('Error saving progress:', error);
            return new NextResponse('Database Error', { status: 500 });
        }

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
