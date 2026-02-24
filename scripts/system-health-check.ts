/**
 * FULL SYSTEM HEALTH CHECK
 * Tests: Database, OpenAI API, DigitalOcean Spaces, Supabase, Admin upload pipeline
 * 
 * Run: npx tsx scripts/system-health-check.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../lib/db';

async function healthCheck() {
    console.log('\n══════════════════════════════════════════════════');
    console.log('  🏥 SYSTEM HEALTH CHECK — Residência Médica App');
    console.log('══════════════════════════════════════════════════\n');

    const results: { name: string; status: 'OK' | 'FAIL' | 'WARN'; detail: string }[] = [];

    // ============================================================
    // 1. ENVIRONMENT VARIABLES
    // ============================================================
    console.log('🔑 1. ENVIRONMENT VARIABLES\n');
    const envVars = {
        // Database
        'DIGITALOCEAN_DB_URL': process.env.DIGITALOCEAN_DB_URL,
        // Supabase
        'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
        // OpenAI
        'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
        // DigitalOcean Spaces
        'SPACES_KEY': process.env.SPACES_KEY,
        'SPACES_SECRET': process.env.SPACES_SECRET,
        'SPACES_BUCKET': process.env.SPACES_BUCKET,
        'SPACES_REGION': process.env.SPACES_REGION,
        'SPACES_ENDPOINT': process.env.SPACES_ENDPOINT,
    };

    for (const [key, val] of Object.entries(envVars)) {
        const ok = !!val && val.length > 0;
        console.log(`  ${ok ? '✅' : '❌'} ${key}: ${ok ? `set (${val!.substring(0, 15)}...)` : 'MISSING!'}`);
        results.push({ name: `ENV: ${key}`, status: ok ? 'OK' : 'FAIL', detail: ok ? 'Present' : 'Missing' });
    }

    // ============================================================
    // 2. DATABASE CONNECTION (DigitalOcean PostgreSQL)
    // ============================================================
    console.log('\n📦 2. DATABASE CONNECTION\n');
    try {
        const { rows: [{ now }] } = await query('SELECT NOW() as now');
        console.log(`  ✅ Connected! Server time: ${now}`);
        results.push({ name: 'DB Connection', status: 'OK', detail: `Connected at ${now}` });

        // Table counts
        const tables = ['documents', 'questions', 'attempts', 'profiles', 'users', 'document_embeddings', 'knowledge_docs', 'knowledge_embeddings'];
        for (const t of tables) {
            try {
                const { rows: [{ count }] } = await query(`SELECT COUNT(*) as count FROM ${t}`);
                console.log(`  📊 ${t}: ${count} records`);
                results.push({ name: `Table: ${t}`, status: 'OK', detail: `${count} records` });
            } catch {
                console.log(`  ⚠️ ${t}: table doesn't exist or error`);
                results.push({ name: `Table: ${t}`, status: 'WARN', detail: 'Not found' });
            }
        }

        // Check pgvector extension
        try {
            const { rows } = await query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
            const hasVector = rows.length > 0;
            console.log(`  ${hasVector ? '✅' : '❌'} pgvector extension: ${hasVector ? 'installed' : 'NOT installed'}`);
            results.push({ name: 'pgvector Extension', status: hasVector ? 'OK' : 'FAIL', detail: hasVector ? 'Installed' : 'Missing' });
        } catch {
            results.push({ name: 'pgvector Extension', status: 'WARN', detail: 'Could not check' });
        }

        // Check explanation generation status
        const { rows: [{ total, with_exp }] } = await query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN explanation IS NOT NULL AND explanation != '' THEN 1 END) as with_exp
            FROM questions
        `);
        console.log(`  📝 Explanations: ${with_exp}/${total}`);
        results.push({ name: 'Question Explanations', status: parseInt(with_exp) > 0 ? 'OK' : 'WARN', detail: `${with_exp}/${total}` });

    } catch (e: any) {
        console.log(`  ❌ Connection FAILED: ${e.message}`);
        results.push({ name: 'DB Connection', status: 'FAIL', detail: e.message });
    }

    // ============================================================
    // 3. OPENAI API
    // ============================================================
    console.log('\n🤖 3. OPENAI API\n');
    try {
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        });
        if (res.ok) {
            const data = await res.json();
            const models = data.data?.map((m: any) => m.id).filter((id: string) =>
                id.includes('gpt-4') || id.includes('gpt-3.5') || id.includes('text-embedding')
            ).slice(0, 5);
            console.log(`  ✅ API accessible! Available models (sample): ${models?.join(', ')}`);
            results.push({ name: 'OpenAI API', status: 'OK', detail: 'Connected' });
        } else {
            const err = await res.text();
            console.log(`  ❌ API error: ${res.status} - ${err.substring(0, 100)}`);
            results.push({ name: 'OpenAI API', status: 'FAIL', detail: `HTTP ${res.status}` });
        }

        // Test embedding generation
        console.log('  Testing embedding generation...');
        const embRes = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: 'Teste de embedding para residência médica',
                dimensions: 1536,
            }),
        });
        if (embRes.ok) {
            const embData = await embRes.json();
            console.log(`  ✅ Embedding OK! Vector dim: ${embData.data[0].embedding.length}, tokens: ${embData.usage.total_tokens}`);
            results.push({ name: 'OpenAI Embeddings', status: 'OK', detail: `Dim=${embData.data[0].embedding.length}` });
        } else {
            console.log(`  ❌ Embedding FAILED`);
            results.push({ name: 'OpenAI Embeddings', status: 'FAIL', detail: 'Failed' });
        }
    } catch (e: any) {
        console.log(`  ❌ OpenAI error: ${e.message}`);
        results.push({ name: 'OpenAI API', status: 'FAIL', detail: e.message });
    }

    // ============================================================
    // 4. DIGITALOCEAN SPACES (S3)
    // ============================================================
    console.log('\n☁️ 4. DIGITALOCEAN SPACES\n');
    try {
        const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
            region: process.env.SPACES_REGION || 'nyc3',
            endpoint: process.env.SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com',
            credentials: {
                accessKeyId: process.env.SPACES_KEY || '',
                secretAccessKey: process.env.SPACES_SECRET || '',
            },
            forcePathStyle: false,
        });

        const bucket = process.env.SPACES_BUCKET || 'residencia-files-prod';
        const command = new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 });
        const response = await s3.send(command);

        console.log(`  ✅ Spaces connected! Bucket: ${bucket}`);
        console.log(`  📁 Objects (sample): ${response.Contents?.length || 0}`);
        response.Contents?.forEach(obj => {
            console.log(`    • ${obj.Key} (${((obj.Size || 0) / 1024).toFixed(1)} KB)`);
        });
        results.push({ name: 'DO Spaces', status: 'OK', detail: `Bucket: ${bucket}, ${response.Contents?.length || 0} objects found` });
    } catch (e: any) {
        console.log(`  ❌ Spaces error: ${e.message}`);
        results.push({ name: 'DO Spaces', status: 'FAIL', detail: e.message });
    }

    // ============================================================
    // 5. SUPABASE (Auth)
    // ============================================================
    console.log('\n🔐 5. SUPABASE\n');
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('Supabase env vars missing');

        // Test health endpoint
        const res = await fetch(`${url}/rest/v1/`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
            },
        });
        console.log(`  ✅ Supabase reachable! Status: ${res.status}`);
        results.push({ name: 'Supabase', status: res.ok ? 'OK' : 'WARN', detail: `HTTP ${res.status}` });
    } catch (e: any) {
        console.log(`  ❌ Supabase error: ${e.message}`);
        results.push({ name: 'Supabase', status: 'FAIL', detail: e.message });
    }

    // ============================================================
    // 6. ADMIN UPLOAD PIPELINE CHECK
    // ============================================================
    console.log('\n📤 6. ADMIN UPLOAD PIPELINE\n');

    // Check required tables for knowledge ingestion
    const knowledgeTables = ['documents', 'document_embeddings'];
    for (const t of knowledgeTables) {
        try {
            const { rows: cols } = await query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = $1 ORDER BY ordinal_position
            `, [t]);
            console.log(`  ✅ ${t}: ${cols.map(c => c.column_name).join(', ')}`);
        } catch {
            console.log(`  ❌ ${t}: missing!`);
        }
    }

    // Check if document_embeddings has vector column
    try {
        const { rows } = await query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'document_embeddings' AND column_name = 'embedding'
        `);
        const type = rows[0]?.data_type;
        console.log(`  ${type ? '✅' : '❌'} embedding column type: ${type || 'MISSING'}`);
        results.push({ name: 'Embedding Vector Column', status: type ? 'OK' : 'FAIL', detail: type || 'Missing' });
    } catch (e: any) {
        console.log(`  ❌ Could not check: ${e.message}`);
    }

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n══════════════════════════════════════════════════');
    console.log('  📊 SUMMARY');
    console.log('══════════════════════════════════════════════════\n');

    const ok = results.filter(r => r.status === 'OK').length;
    const warn = results.filter(r => r.status === 'WARN').length;
    const fail = results.filter(r => r.status === 'FAIL').length;

    console.log(`  ✅ OK: ${ok}   ⚠️ WARN: ${warn}   ❌ FAIL: ${fail}\n`);

    if (fail > 0) {
        console.log('  FAILURES:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`    ❌ ${r.name}: ${r.detail}`);
        });
    }
    if (warn > 0) {
        console.log('  WARNINGS:');
        results.filter(r => r.status === 'WARN').forEach(r => {
            console.log(`    ⚠️ ${r.name}: ${r.detail}`);
        });
    }

    console.log('\n══════════════════════════════════════════════════\n');
    process.exit(fail > 0 ? 1 : 0);
}

healthCheck().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
