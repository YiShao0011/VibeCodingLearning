# Email Writer

Simple web page to generate email replies using an LLM, based on your instructions and a pasted email thread.

## Prerequisites
- Node.js 18+
- Either OpenAI or Azure OpenAI credentials

### Option A: OpenAI
- Set `OPENAI_API_KEY`
- Optional: set `OPENAI_MODEL` (default `gpt-4.1-mini`)

### Option B: Azure OpenAI (Preferred)
- Set `USE_AZURE=true`
- Set `AZURE_OPENAI_API_KEY`
- Set `AZURE_OPENAI_ENDPOINT` (e.g., `https://your-resource.openai.azure.com`)
- Set `AZURE_OPENAI_DEPLOYMENT` (your model deployment name, e.g., `gpt-4o-mini`)
- For speech-to-text, set `AZURE_OPENAI_WHISPER_DEPLOYMENT` (e.g., `whisper-1`) and optionally `AZURE_OPENAI_API_VERSION` (default `2024-06-01`).

## Setup

Create a `.env` file in the project root (Azure example):

```
USE_AZURE=true
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1
PORT=3000
```

Install dependencies:

```
npm install
```

Start the server:

```
npm start
```

Open in browser:

```
http://localhost:3000
```

## Usage
- Enter high-level guidance in "Instructions".
- Paste the entire email thread in "Email Thread".
- Click "Generate Reply". The response appears below.
- Optional: Use the 🎙️ Record button next to Instructions to speak your guidance; it will transcribe via Azure Whisper and insert into the Instructions box.

## Notes
- To switch back to OpenAI, remove `USE_AZURE=true` and set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`).
- The prompt aims for professional, concise replies; adjust temperature or prompt in `server.js`.
 - Whisper transcription requires an Azure Whisper deployment and microphone permission in the browser.
