
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Force use of the last key if multiple exist (manual split for safety)
// But dotenv should handle last-write-wins. 
// Let's print the key (masked) to be sure.
const key = process.env.OPENAI_API_KEY || '';
console.log('Testing OpenAI connection...');
console.log('API Key length:', key.length);
console.log('API Key start:', key.substring(0, 10));

const openai = new OpenAI({
    apiKey: key,
});

async function testConnection() {
    try {
        const list = await openai.models.list();
        console.log('Success! Connected to OpenAI.');
        // console.log('Available models:', list.data.length);
        console.log('Checking for gpt-4o...');
        const gpt4o = list.data.find(m => m.id === 'gpt-4o');
        if (gpt4o) {
            console.log('GPT-4o is available!');
        } else {
            console.warn('GPT-4o NOT found in model list. Check key permissions.');
        }
    } catch (error) {
        console.error('Error connecting to OpenAI:', error);
    }
}

testConnection();
