
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error('Missing environment variables. Check .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function generateEmbeddings() {
    console.log('Starting embeddings generation (JS Mode)...');

    // 1. Fetch questions
    const { data: questions, error } = await supabase
        .from('questions')
        .select('id, content, alternatives')
        .not('content', 'is', null);

    if (error) {
        console.error('Error fetching questions:', error);
        return;
    }

    console.log(`Found ${questions.length} questions.`);

    let processedCount = 0;

    for (const question of questions) {
        try {
            // Check if embedding already exists
            const { data: existing } = await supabase
                .from('question_embeddings')
                .select('id')
                .eq('question_id', question.id)
                .single();

            if (existing) {
                processedCount++;
                if (processedCount % 50 === 0) console.log(`Skipping already processed (${processedCount}/${questions.length})`);
                continue;
            }

            // Prepare text content for embedding
            const alternativesText = question.alternatives ? question.alternatives.map(a => a.text).join(' ') : '';
            const textToEmbed = `Questão: ${question.content}\nAlternativas: ${alternativesText}`;

            // Generate embedding
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: textToEmbed.substring(0, 8000),
                dimensions: 1536,
            });

            const embedding = response.data[0].embedding;

            // Save to Supabase
            const { error: insertError } = await supabase
                .from('question_embeddings')
                .insert({
                    question_id: question.id,
                    content: question.content,
                    embedding: embedding,
                });

            if (insertError) {
                console.error(`Error inserting embedding for question ${question.id}:`, insertError);
            } else {
                processedCount++;
                if (processedCount % 10 === 0) {
                    console.log(`Processed ${processedCount}/${questions.length} questions`);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms pause

        } catch (err) {
            console.error(`Failed to process question ${question.id}:`, err);
        }
    }

    console.log('Finished generating embeddings!');
}

generateEmbeddings();
