import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 读取 .env 文件内容用于调试
const envFilePath = path.resolve('.env');
console.log('=== .env 文件内容 ===');
if (fs.existsSync(envFilePath)) {
  const envContent = fs.readFileSync(envFilePath, 'utf-8');
  const lines = envContent.split('\n').filter(line => line.includes('SPEECH'));
  lines.forEach(line => console.log(line));
} else {
  console.log('.env 文件不存在');
}

const result = dotenv.config({ override: true });
console.log('.env 文件加载结果:', result.error ? result.error : 'Success');
console.log('dotenv 加载的值:');
if (result.parsed) {
  console.log('  SPEECH_PHRASES:', result.parsed.SPEECH_PHRASES);
  console.log('  SPEECH_LOCALES:', result.parsed.SPEECH_LOCALES);
}
console.log('初始化时的环境变量:');
console.log('  SPEECH_PHRASES:', process.env.SPEECH_PHRASES);
console.log('  SPEECH_LOCALES:', process.env.SPEECH_LOCALES);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer 配置用于音频上传 
const upload = multer({ storage: multer.memoryStorage() });

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `You are a professional email assistant. Your task is to help a user named Yi Shao draft email replies.
Follow the two-step workflow below:

1. **Clarify Voice Instructions**: The incoming content may originate from speech-to-text transcription and can contain inaccuracies—especially for names, internal terminology, or domain-specific terms.
Your tasks are:
- Cross-reference the email context to identify and correct any likely transcription errors.
- Reorganize and refine the content into clear, concise, and well-structured instructions.
- Preserve the speaker's intent without adding information not supported by the context.

2. **Compose Email Response**: Based on the clarified instructions and the broader email thread, generate a professional and context-appropriate email response on behalf of Yi Shao.


**Output Format:**
[CLARIFIED_INSTRUCTIONS]
[Your reorganized and clarified understanding of the user's instructions]

[EMAIL_RESPONSE]
[Your professional email response]`;

// 获取默认系统提示词的路由
app.get('/api/default-prompt', (req, res) => {
  res.json({ defaultPrompt: DEFAULT_SYSTEM_PROMPT });
});

// 生成回复的路由
app.post('/api/generate', async (req, res) => {
  try {
    const { instructions, emailThread, systemPrompt } = req.body;

    if (!instructions || !emailThread) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const useAzure = process.env.USE_AZURE === 'true' || !!process.env.AZURE_OPENAI_API_KEY;
    
    if (!useAzure) {
      return res.status(400).json({ error: 'Azure OpenAI is required' });
    }

    // Azure OpenAI 配置
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';

    if (!endpoint || !apiKey) {
      return res.status(400).json({ error: 'Azure OpenAI credentials not configured' });
    }

    // 构建请求消息
    const messages = [
      {
        role: 'system',
        content: systemPrompt || DEFAULT_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: `Voice-to-text Instructions: ${instructions}\n\nEmail Thread:\n${emailThread}\n\nPlease first clarify the instructions, then generate an appropriate email response.`
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
    const fullText = data.choices[0].message.content;
    
    // 解析输出，分离"整理后的指令"和"邮件回复"
    let clarifiedInstructions = '';
    let emailResponse = '';
    
    const clarifiedMatch = fullText.match(/\[CLARIFIED_INSTRUCTIONS\]\s*([\s\S]*?)\s*\[EMAIL_RESPONSE\]/i);
    const responseMatch = fullText.match(/\[EMAIL_RESPONSE\]\s*([\s\S]*?)$/i);
    
    if (clarifiedMatch && responseMatch) {
      clarifiedInstructions = clarifiedMatch[1].trim();
      emailResponse = responseMatch[1].trim();
    } else {
      // 如果没有找到标记，将全部内容作为邮件回复
      emailResponse = fullText;
    }

    res.json({
      text: emailResponse,
      clarifiedInstructions: clarifiedInstructions,
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

    // 简单校验：文件过小可能被判定为某类
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

    const useAzure = process.env.USE_AZURE === 'true' || !!process.env.AZURE_SPEECH_KEY;
    
    if (!useAzure) {
      return res.status(400).json({ error: 'Azure Speech is required' });
    }

    const speechRegion = process.env.AZURE_SPEECH_REGION || '';
    const speechKey = process.env.AZURE_SPEECH_KEY || '';
    const apiVersion = '2025-10-15';

    if (!speechRegion || !speechKey) {
      return res.status(400).json({ error: 'Azure Speech credentials not configured' });
    }

    // 后端配置的短语列表
    // 支持格式：多个短语用逗号分隔
    const speechPhrasesEnv = process.env.SPEECH_PHRASES || '';
    
    // 不区分语言，locales 为空
    const locales = [];
    
    // 解析短语列表（不区分语言）
    const phrases = speechPhrasesEnv ? speechPhrasesEnv.split(',').map(p => p.trim()) : [];

    console.log('Speech Configuration:', {
      locales,
      phrases,
      SPEECH_PHRASES: process.env.SPEECH_PHRASES,
      SPEECH_LOCALES: process.env.SPEECH_LOCALES
    });

    // Azure Speech fast transcription API
    const transcribeUrl = `https://${speechRegion}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=${apiVersion}`;
    const formData = new FormData();
    formData.append('audio', req.file.buffer, { filename: fileName, contentType: mimeType });
    
    // 构建 definition 对象
    const definition = {
      locales: locales,
      ...(phrases.length > 0 && { phraseList: { phrases: phrases } })
    };
    
    formData.append('definition', JSON.stringify(definition), { contentType: 'application/json' });

    // 打印发送给 Azure Speech API 的请求信息
    console.log('=== Azure Speech API Request ===');
    console.log('URL:', transcribeUrl);
    console.log('Headers:', {
      'Ocp-Apim-Subscription-Key': speechKey ? '***' + speechKey.slice(-10) : 'not set',
      'Content-Type': 'multipart/form-data'
    });
    console.log('Definition:', JSON.stringify(definition, null, 2));
    console.log('Audio File:', {
      name: fileName,
      type: mimeType,
      size: req.file.size
    });
    console.log('================================');

    const response = await fetch(transcribeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Azure Speech error:', error);
      return res.status(response.status).json({ error: 'Failed to transcribe audio' });
    }

    const data = await response.json();
    console.log('Azure Speech API Response:', JSON.stringify(data, null, 2));
    
    // Azure Speech fast transcription API 返回的格式
    const transcribedText = data.combinedPhrases?.[0]?.text || data.phrases?.[0]?.text || '';
    res.json({ text: transcribedText });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
