# Email Writer - AI Email Response Generator

使用 Azure OpenAI 的智能邮件回复生成器

## 功能特性

- 📧 **AI 驱动**：使用 Azure OpenAI GPT-4 生成专业邮件回复
- 🎙️ **语音输入**：通过麦克风录音，使用 Whisper API 自动转录
- 🎨 **现代 UI**：Glass-morphism 设计，支持深色/浅色主题
- 💾 **自动保存**：使用 localStorage 保存输入内容
- ⌨️ **快捷键**：按 Ctrl+Enter 快速生成回复
- 📋 **提示词预览**：查看发送给 LLM 的完整提示词

## 安装

1. 克隆或下载项目
2. 安装依赖：
   ```bash
   npm install
   ```

## 配置

创建或编辑 `.env` 文件，添加以下内容：

```env
USE_AZURE=true

# Chat Completions 配置（GPT-4）
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_API_VERSION=2024-06-01

# Whisper 配置（语音转文字）
AZURE_OPENAI_WHISPER_ENDPOINT=https://your-speech-resource.cognitiveservices.azure.com/
AZURE_OPENAI_WHISPER_API_KEY=your-whisper-api-key
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper

PORT=3000
```

### 获取 API 密钥

1. **Azure OpenAI 资源**（Chat）：
   - 访问 [Azure Portal](https://portal.azure.com)
   - 创建或选择 OpenAI 资源
   - 获取 API 密钥和端点

2. **Azure Cognitive Services Speech 资源**（Whisper）：
   - 创建 Cognitive Services Speech 资源
   - 获取 API 密钥和端点

## 运行

```bash
npm start
```

访问 `http://localhost:3000`

## 使用方法

1. **设置系统提示词**：定义 AI 的行为和风格（可选）
2. **输入指示**：告诉 AI 如何生成回复（例如：写得更正式）
   - 可用鼠标记录语音，AI 会自动转录
3. **粘贴邮件内容**：完整的邮件对话
4. **点击"生成回复"**或按 `Ctrl+Enter`
5. **复制结果**：点击"复制"按钮或手动复制

## 技术栈

- **前端**：HTML5、CSS3、Vanilla JavaScript
- **后端**：Node.js、Express.js
- **AI 服务**：Azure OpenAI（Chat Completions & Whisper）
- **其他**：Multer（文件上传）、Dotenv（环境配置）

## 文件结构

```
email writer/
├── server.js                 # Express 服务器
├── package.json             # 项目配置
├── .env                     # 环境变量（不提交）
├── public/
│   ├── index.html          # 主页
│   ├── style.css           # 样式
│   ├── app.js              # 前端逻辑
└── test-whisper.js         # Whisper API 测试脚本
```

## API 端点

### POST /api/generate
生成邮件回复

**请求：**
```json
{
  "instructions": "写得更正式",
  "emailThread": "完整邮件内容",
  "systemPrompt": "自定义系统提示词"
}
```

**响应：**
```json
{
  "text": "生成的邮件回复",
  "promptPreview": {
    "model": "gpt-4.1",
    "messages": [...]
  }
}
```

### POST /api/transcribe
转录音频文件

**请求：**
- Content-Type: multipart/form-data
- Body: 音频文件

**响应：**
```json
{
  "text": "转录文本"
}
```

## 故障排除

### 404 错误
- 检查 Azure 资源端点是否正确
- 确保部署名称匹配

### 401 错误
- 验证 API 密钥是否正确
- 检查 API 密钥是否过期

### 语音转文字不工作
- 检查是否使用了 Speech 资源而不是 OpenAI 资源
- 验证 Whisper 部署名称
- 确保音频文件至少 0.1 秒长

## 许可证

MIT
