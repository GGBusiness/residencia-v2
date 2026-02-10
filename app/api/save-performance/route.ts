import { NextRequest, NextResponse } from 'next/server';
import { aiEngine } from '@/lib/ai-recommendation-engine';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            userId,
            questionId,
            attemptId,
            userAnswer,
            correct,
            timeSpentSeconds,
            area,
            subarea,
            difficulty,
            institution,
            year,
        } = body;

        // Validar dados
        if (!userId || !questionId) {
            return NextResponse.json(
                { error: 'userId and questionId are required' },
                { status: 400 }
            );
        }

        // Salvar performance
        await aiEngine.savePerformance({
            userId,
            questionId,
            attemptId,
            userAnswer,
            correct,
            timeSpentSeconds,
            area,
            subarea,
            difficulty,
            institution,
            year,
        });

        return NextResponse.json({
            success: true,
            message: 'Performance saved successfully',
        });

    } catch (error: any) {
        console.error('Error saving performance:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
