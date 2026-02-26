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
        const prompt = `Você é um tutor carinhoso e especialista focado na aprovação de médicos para a Residência Médica (ENARE, USP, UNIFESP).
Sua missão é gerar UMA única notificação push curta para o celular do aluno.

Sorteie ALEATORIAMENTE um dos seguintes 4 temas para a notificação de hoje. Seja muito autêntico e direto ao ponto:
1. Dica de Ouro (High-yield): Uma dica médica ultra específica e rápida que cai muito em provas (Ex: Pediatria, GO, Cirurgia).
2. Motivação e Foco: Uma mensagem enérgica e encorajadora para o estudo ou para os plantões exaustivos.
3. Qualidade de Vida & Estudo: Uma dica de como descansar melhor, lidar com burnout, alimentação ou gestão de tempo.
4. Técnica de Memorização: Um macete, mnemônico ou técnica rápida para lembrar de algo denso.

O formato deve ser um JSON estrito com dois campos limitados em caracteres para caber na notificação do celular:
{
  "title": "Título curto com emoji (ex: 🧠 Macete de GO, ou ⚡ Hora de Focar!)",
  "message": "Mensagem curta, carinhosa mas muito direta (máximo 120 caracteres)."
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
