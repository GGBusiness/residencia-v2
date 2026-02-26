import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GPT_MODEL } from '@/lib/model-config';

// Vercel Cron Jobs will hit this endpoint
export async function GET(request: Request) {
    try {
        // Protect the endpoint (Vercel Cron injects a secret)
        const authHeader = request.headers.get('authorization');
        if (
            process.env.CRON_SECRET &&
            authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
            process.env.NODE_ENV === 'production'
        ) {
            return new Response('Unauthorized', { status: 401 });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // 1. Generate Trivia with OpenAI
        const prompt = `Você é um tutor de Residência Médica. 
Gere UMA única dica rápida de estudo ou curiosidade médica de alto rendimento (high-yield) focada em provas do ENARE, USP ou UNIFESP.
Temas possíveis: Clínica Médica, Cirurgia, Ginecologia e Obstetrícia, Pediatria, ou Preventiva.

O formato deve ser um JSON estrito:
{
  "title": "Título curto (ex: 🩺 Dica de Pediatria)",
  "message": "Mensagem curta (máximo 120 caracteres, ex: A dose do paracetamol é X. Cuidado com hepatotoxicidade nas provas!)"
}`;

        const aiResponse = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [{ role: 'system', content: prompt }],
            response_format: { type: 'json_object' }
        });

        const tip = JSON.parse(aiResponse.choices[0].message.content || '{}');

        if (!tip.title || !tip.message) {
            throw new Error('Falha na geração da dica pela Inteligência Artificial');
        }

        // 2. Disparar o Push Global via OneSignal REST API
        const onesignalUrl = 'https://onesignal.com/api/v1/notifications';

        const payload = {
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
            included_segments: ['Subscribed Users'], // Manda para todo mundo que aceitou as notificações
            contents: {
                en: tip.message,
                pt: tip.message
            },
            headings: {
                en: tip.title,
                pt: tip.title
            }
        };

        const pushResponse = await fetch(onesignalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const pushResult = await pushResponse.json();

        return NextResponse.json({
            success: true,
            tip_generated: tip,
            onesignal_result: pushResult
        });

    } catch (error: any) {
        console.error('Error generating daily trivia push:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
