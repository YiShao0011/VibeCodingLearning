import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';

// Load .env from project root
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const audioPath = process.argv[2];
if (!audioPath) {
  console.error('Usage: node scripts/test-transcribe.js <path-to-audio-file>');
  process.exit(1);
}

if (!fs.existsSync(audioPath)) {
  console.error(`Audio file not found: ${audioPath}`);
  process.exit(1);
}

const endpoint = process.env.AZURE_OPENAI_WHISPER_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || '';
const apiKey = process.env.AZURE_OPENAI_WHISPER_API_KEY || process.env.AZURE_OPENAI_API_KEY || '';
const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'gpt-4o-transcribe-diarize';
const apiVersion = '2025-03-01-preview';

if (!endpoint || !apiKey) {
  console.error('Missing endpoint or apiKey in environment variables.');
  process.exit(1);
}

const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/audio/transcriptions?api-version=${apiVersion}`;

async function main() {
  const form = new FormData();
  form.append('file', fs.createReadStream(audioPath));
  form.append('model', deployment);
  form.append('response_format', 'json');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    const text = await res.text();
    console.log('Status:', res.status, res.statusText);
    console.log('Body:', text);
  } catch (err) {
    console.error('Request failed:', err);
  }
}

main();
