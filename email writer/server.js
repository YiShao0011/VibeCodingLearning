import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer 配置用于音频上传
const upload = multer({ storage: multer.memoryStorage() });

// 生成回复的路由
app.post('/api/generate', async (req, res) => {
  try {
    const { instructions, emailThread, systemPrompt } = req.body;

    if (!instructions || !emailThread) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const useAzure = process.env.USE_AZURE === 'true';
    
    if (!useAzure) {
      return res.status(400).json({ error: 'Azure OpenAI is required' });
    }

    // Azure OpenAI 配置
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';

    // 构建请求消息
    const messages = [
      {
        role: 'system',
        content: systemPrompt || 'You are an expert email writer. Generate professional, clear, and concise email responses.'
      },
      {
        role: 'user',
        content: `Instructions: ${instructions}\n\nEmail Thread:\n${emailThread}\n\nPlease generate an appropriate response.`
      }
    ];

    // 调用 Azure OpenAI
    const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Azure OpenAI error:', error);
      return res.status(response.status).json({ error: 'Failed to generate response' });
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    res.json({
      text: text,
      promptPreview: {
        model: deployment,
        messages: messages
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 转录音频的路由
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const useAzure = process.env.USE_AZURE === 'true';
    
    if (!useAzure) {
      return res.status(400).json({ error: 'Azure OpenAI is required' });
    }

    const endpoint = process.env.AZURE_OPENAI_WHISPER_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || '';
    const apiKey = process.env.AZURE_OPENAI_WHISPER_API_KEY || process.env.AZURE_OPENAI_API_KEY || '';
    const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';

    const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/audio/transcriptions?api-version=${apiVersion}`;

    // 构建 multipart form data
    const boundary = '----Boundary' + Math.random().toString(16).slice(2);
    
    const parts = [];
    parts.push(`--${boundary}`);
    parts.push('Content-Disposition: form-data; name="file"; filename="audio.wav"');
    parts.push('Content-Type: audio/wav');
    parts.push('');

    const bodyBuffer = Buffer.concat([
      Buffer.from(parts.join('\r\n') + '\r\n'),
      req.file.buffer,
      Buffer.from(`\r\n--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="response_format"\r\n\r\njson\r\n'),
      Buffer.from(`--${boundary}--`)
    ]);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'api-key': apiKey
      },
      body: bodyBuffer
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper error:', error);
      return res.status(response.status).json({ error: 'Failed to transcribe audio' });
    }

    const data = await response.json();
    res.json({ text: data.text });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
