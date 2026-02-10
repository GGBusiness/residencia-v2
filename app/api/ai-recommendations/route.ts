import { NextRequest, NextResponse } from 'next/server';
import { aiEngine } from '@/lib/ai-recommendation-engine';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, questionCount = 20, focusMode = 'balanced' } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Gerar recomendações personalizadas
        const recommendations = await aiEngine.generateRecommendations({
            userId,
            questionCount,
            focusMode,
        });

        return NextResponse.json({
            success: true,
            questions: recommendations,
            count: recommendations.length,
        });

    } catch (error: any) {
        console.error('Error generating recommendations:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Obter insights do perfil
        const insights = await aiEngine.getInsights(userId);

        return NextResponse.json(insights);

    } catch (error: any) {
        console.error('Error fetching insights:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
