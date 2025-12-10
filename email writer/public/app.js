// DOM 元素
const systemPromptEl = document.getElementById('systemPrompt');
const instructionsEl = document.getElementById('instructions');
const emailThreadEl = document.getElementById('emailThread');
const generateBtn = document.getElementById('generateBtn');
const resultEl = document.getElementById('result');
const copyBtn = document.getElementById('copyBtn');
const promptPreviewEl = document.getElementById('promptPreview');
const loadingEl = document.getElementById('loadingIndicator');
const recordBtn = document.getElementById('recordBtn');
const recordingStatusEl = document.getElementById('recordingStatus');
const themeToggle = document.getElementById('themeToggle');

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordStartTime = 0;
let lastDurationMs = 0;

// 主题切换
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️ 浅色模式' : '🌙 深色模式';
});

// 初始化主题
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️ 浅色模式';
}

// 语音录制：使用 pointer 事件，避免鼠标/触摸重复触发
recordBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startRecording();
});

const stopIfRecording = (e) => {
    e.preventDefault();
    stopRecording();
};

recordBtn.addEventListener('pointerup', stopIfRecording);
recordBtn.addEventListener('pointercancel', stopIfRecording);
recordBtn.addEventListener('pointerleave', stopIfRecording);

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recordStartTime = Date.now();
        lastDurationMs = 0;

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
            lastDurationMs = Date.now() - recordStartTime;
            if (lastDurationMs < 1000) {
                recordingStatusEl.textContent = '录音太短，请按住说话超过 1 秒';
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            saveBlobLocally(audioBlob);
            await transcribeAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        recordBtn.classList.add('recording');
        recordingStatusEl.textContent = '🎙️ 录音中...';
    } catch (error) {
        console.error('Error accessing microphone:', error);
        recordingStatusEl.textContent = '❌ 无法访问麦克风';
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordingStatusEl.textContent = '处理音频中...';
    }
}

function saveBlobLocally(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function transcribeAudio(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            recordingStatusEl.textContent = `❌ 转录失败: ${error.error}`;
            return;
        }

        const data = await response.json();
        instructionsEl.value += (instructionsEl.value ? ' ' : '') + data.text;
        recordingStatusEl.textContent = '✓ 转录成功';
        setTimeout(() => {
            recordingStatusEl.textContent = '';
        }, 3000);
    } catch (error) {
        console.error('Error transcribing audio:', error);
        recordingStatusEl.textContent = `❌ 错误: ${error.message}`;
    }
}

// 生成回复
generateBtn.addEventListener('click', async () => {
    const instructions = instructionsEl.value.trim();
    const emailThread = emailThreadEl.value.trim();
    const systemPrompt = systemPromptEl.value.trim();

    if (!instructions || !emailThread) {
        alert('请填写指示和邮件内容');
        return;
    }

    // 显示加载状态
    loadingEl.classList.remove('hidden');
    generateBtn.disabled = true;
    resultEl.innerHTML = '';
    copyBtn.classList.add('hidden');

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instructions,
                emailThread,
                systemPrompt
            })
        });

        if (!response.ok) {
            const error = await response.json();
            resultEl.innerHTML = `<p style="color: #ff6b6b;">❌ 错误: ${error.error}</p>`;
            loadingEl.classList.add('hidden');
            generateBtn.disabled = false;
            return;
        }

        const data = await response.json();

        // 显示结果
        resultEl.textContent = data.text;
        copyBtn.classList.remove('hidden');

        // 显示提示词预览
        const prompt = data.promptPreview;
        const previewText = `模型: ${prompt.model}\n\n消息:\n${JSON.stringify(prompt.messages, null, 2)}`;
        promptPreviewEl.textContent = previewText;

        // 保存到本地存储
        localStorage.setItem('lastResult', data.text);
    } catch (error) {
        console.error('Error:', error);
        resultEl.innerHTML = `<p style="color: #ff6b6b;">❌ 错误: ${error.message}</p>`;
    } finally {
        loadingEl.classList.add('hidden');
        generateBtn.disabled = false;
    }
});

// 复制按钮
copyBtn.addEventListener('click', () => {
    const text = resultEl.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ 已复制';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
    });
});

// 快捷键 (Ctrl+Enter)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        generateBtn.click();
    }
});

// 加载保存的数据
window.addEventListener('load', () => {
    const savedInstructions = localStorage.getItem('instructions');
    const savedEmailThread = localStorage.getItem('emailThread');
    const savedSystemPrompt = localStorage.getItem('systemPrompt');

    if (savedInstructions) instructionsEl.value = savedInstructions;
    if (savedEmailThread) emailThreadEl.value = savedEmailThread;
    if (savedSystemPrompt) systemPromptEl.value = savedSystemPrompt;
});

// 自动保存
instructionsEl.addEventListener('input', () => {
    localStorage.setItem('instructions', instructionsEl.value);
});

emailThreadEl.addEventListener('input', () => {
    localStorage.setItem('emailThread', emailThreadEl.value);
});

systemPromptEl.addEventListener('input', () => {
    localStorage.setItem('systemPrompt', systemPromptEl.value);
});
