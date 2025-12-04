const $ = (id) => document.getElementById(id);

const generateBtn = $('generateBtn');
const instructionsEl = $('instructions');
const systemPromptEl = $('systemPrompt');
const emailThreadEl = $('emailThread');
const resultEl = $('result');
const promptEl = $('promptBox');
const loaderEl = $('loader');
const copyBtn = $('copyBtn');
const themeToggle = $('themeToggle');
const recordBtn = $('recordBtn');
const recordStatus = $('recordStatus');

function setLoading(state) {
  if (state) {
    loaderEl.classList.remove('hidden');
    generateBtn.disabled = true;
  } else {
    loaderEl.classList.add('hidden');
    generateBtn.disabled = false;
  }
}

async function generate() {
  const instructions = instructionsEl.value.trim();
  const systemPrompt = (systemPromptEl.value || '').trim() || 'You are a helpful email writing assistant. Write a professional, concise email reply. Preserve important context and maintain the thread etiquette (greeting, acknowledgements, direct answers, next steps).';
  const emailThread = emailThreadEl.value.trim();
  if (!instructions || !emailThread) {
    resultEl.textContent = 'Please fill in both inputs.';
    copyBtn.disabled = true;
    return;
  }

  setLoading(true);
  resultEl.textContent = '';
  promptEl.textContent = '';
  copyBtn.disabled = true;
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructions, emailThread, systemPrompt })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    resultEl.textContent = data.text || '';
    if (data.promptPreview) {
      const { model, messages } = data.promptPreview;
      const pretty = [
        `Model: ${model}`,
        '',
        ...messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`)
      ].join('\n\n');
      promptEl.textContent = pretty;
    }
    copyBtn.disabled = !data.text;
  } catch (err) {
    resultEl.textContent = 'Error: ' + (err.message || 'Failed to generate');
    copyBtn.disabled = true;
  } finally {
    setLoading(false);
  }
}

generateBtn.addEventListener('click', generate);

copyBtn.addEventListener('click', () => {
  const text = resultEl.textContent.trim();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = 'Copied';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1600);
  });
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

// Submit with Ctrl+Enter inside thread textarea
emailThreadEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    generate();
  }
});

// Voice recording and transcription (Azure Whisper)
let mediaRecorder;
let recordedChunks = [];

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = transcribeRecording;
    mediaRecorder.start();
    recordStatus.textContent = 'Recording…';
    recordBtn.textContent = 'Stop';
  } catch (err) {
    recordStatus.textContent = 'Mic not available';
    console.error('Recording error:', err);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    recordStatus.textContent = 'Uploading…';
    recordBtn.textContent = '🎙️ Record';
  }
}

async function transcribeRecording() {
  try {
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');
    const res = await fetch('/api/transcribe', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Transcription failed');
    const existing = instructionsEl.value.trim();
    instructionsEl.value = existing ? existing + '\n' + data.text : data.text;
    recordStatus.textContent = 'Transcribed';
  } catch (err) {
    recordStatus.textContent = 'Error: ' + (err.message || 'Transcription failed');
  }
}

recordBtn.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    startRecording();
  } else {
    stopRecording();
  }
});
