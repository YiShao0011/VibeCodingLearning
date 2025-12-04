import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import multer from 'multer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Config: OpenAI or Azure OpenAI
const useAzure = process.env.USE_AZURE === 'true';
let openai;
let model;
let azureConfig = null;
let azureWhisperClient = null;

if (useAzure) {
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, ''); // trim trailing slash
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT; // deployment name in portal
  const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';
  if (azureKey && azureEndpoint && azureDeployment) {
    // We'll call Azure manually since the OpenAI SDK needs api-version in query.
    openai = { _azure: true, key: azureKey, endpoint: azureEndpoint, deployment: azureDeployment, apiVersion: azureApiVersion };
    model = azureDeployment;
    azureConfig = { key: azureKey, endpoint: azureEndpoint, apiVersion: azureApiVersion };
    
    // Create a separate Azure client for Whisper with AzureOpenAI SDK-compatible config
    const whisperDeployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper';
    azureWhisperClient = {
      endpoint: azureEndpoint,
      key: azureKey,
      deployment: whisperDeployment,
      apiVersion: azureApiVersion
    };
  }
} else {
  const apiKey = process.env.OPENAI_API_KEY;
  model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  if (apiKey) {
    openai = new OpenAI({ apiKey });
  }
}

app.post('/api/generate', async (req, res) => {
  try {
    const { instructions, emailThread, systemPrompt } = req.body;
    if (!instructions || !emailThread) {
      return res.status(400).json({ error: 'Both instructions and emailThread are required.' });
    }
    if (!openai) {
      const msg = useAzure
        ? 'Azure OpenAI not configured. Set USE_AZURE=true and AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT.'
        : 'OpenAI not configured. Set OPENAI_API_KEY.';
      return res.status(500).json({ error: msg });
    }

    const system = systemPrompt || 'You are a helpful email writing assistant. Write a professional, concise email reply. Preserve important context and maintain the thread etiquette (greeting, acknowledgements, direct answers, next steps).';
    const user = `Instructions:\n${instructions}\n\nEmail Thread Context:\n${emailThread}`;
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];

    let text = '';
    if (openai._azure) {
      // Manual Azure REST request
      const url = `${openai.endpoint}/openai/deployments/${openai.deployment}/chat/completions?api-version=${openai.apiVersion}`;
      const payload = {
        messages,
        temperature: 0.4,
        max_tokens: 800
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': openai.key
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error('Azure response error:', response.status, errText);
        return res.status(500).json({ error: `Azure OpenAI error ${response.status}.` });
      }
      const data = await response.json();
      text = data.choices?.[0]?.message?.content || '';
      return res.json({ text, promptPreview: { model: openai.deployment, messages } });
    } else {
      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 800
      });
      text = response.choices?.[0]?.message?.content || '';
      return res.json({ text, promptPreview: { model, messages } });
    }
    
  } catch (err) {
    console.error('Generation error:', err?.response?.data || err);
    res.status(500).json({ error: 'Failed to generate email response.' });
  }
});

// Speech-to-text using Azure OpenAI Whisper via direct REST API
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!useAzure || !azureWhisperClient) {
      return res.status(400).json({ error: 'Transcription requires Azure OpenAI. Set USE_AZURE=true and AZURE_OPENAI_WHISPER_DEPLOYMENT.' });
    }
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    const url = `${azureWhisperClient.endpoint}/openai/deployments/${azureWhisperClient.deployment}/audio/transcriptions?api-version=${azureWhisperClient.apiVersion}`;
    console.log('Whisper transcription URL:', url);

    // Build FormData-compatible multipart body
    const boundary = '----Boundary' + Math.random().toString(16).slice(2);
    const parts = [];
    
    // Add file
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="file"; filename="${file.originalname || 'audio.webm'}"`);
    parts.push(`Content-Type: ${file.mimetype || 'audio/webm'}`);
    parts.push('');
    
    const bodyBuffer = Buffer.concat([
      Buffer.from(parts.join('\r\n') + '\r\n'),
      file.buffer,
      Buffer.from(`\r\n--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="response_format"\r\n\r\njson\r\n'),
      Buffer.from(`--${boundary}--`)
    ]);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'api-key': azureWhisperClient.key
      },
      body: bodyBuffer
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Azure Whisper error:', response.status, errText);
      console.error('URL:', url);
      return res.status(500).json({ error: `Whisper error ${response.status}: ${errText}` });
    }

    const data = await response.json();
    console.log('Transcription result:', data);
    res.json({ text: data.text || '' });
  } catch (err) {
    console.error('Transcription error:', err?.message || err);
    res.status(500).json({ error: `Failed to transcribe: ${err?.message || 'Unknown error'}` });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
