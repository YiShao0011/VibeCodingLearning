import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
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

    const headerHex = req.file.buffer.slice(0, 16).toString('hex');
    const sniffMime = (hex) => {
      if (hex.startsWith('52494646')) return { mime: 'audio/wav', ext: 'wav' }; // RIFF....
      if (hex.startsWith('1a45dfa3')) return { mime: 'audio/webm', ext: 'webm' }; // EBML/WebM
      if (hex.startsWith('4f676753')) return { mime: 'audio/ogg', ext: 'ogg' }; // OggS
      return null;
    };
    const sniffed = sniffMime(headerHex);
    const mimeType = sniffed?.mime || req.file.mimetype || 'audio/mpeg';
    const fileExt = sniffed?.ext || (req.file.originalname?.split('.').pop() || 'mp3');
    const fileName = req.file.originalname || `audio.${fileExt}`;

    // 简单校验：文件过小可能被判定为损坏
    if (req.file.size < 500) {
      return res.status(400).json({ error: 'Audio file too small, please record a bit longer and try again.' });
    }

    console.log('Transcribe upload:', {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      size: req.file.size,
      headerHex,
      sniffedMime: mimeType
    });

    const useAzure = process.env.USE_AZURE === 'true';
    
    if (!useAzure) {
      return res.status(400).json({ error: 'Azure OpenAI is required' });
    }

    const endpoint = process.env.AZURE_OPENAI_WHISPER_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || '';
    const apiKey = process.env.AZURE_OPENAI_WHISPER_API_KEY || process.env.AZURE_OPENAI_API_KEY || '';
    const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper';
    const apiVersion = '2025-03-01-preview';

    // 统一走 audio/transcriptions，使用 multipart/form-data + Bearer
    const transcribeUrl = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/audio/transcriptions?api-version=${apiVersion}`;
    const formData = new FormData();
    formData.append('file', req.file.buffer, { filename: fileName, contentType: mimeType });
    formData.append('model', deployment);
    formData.append('response_format', 'json');

    const response = await fetch(transcribeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
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
