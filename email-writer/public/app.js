// DOM 元素
const systemPromptEl = document.getElementById('systemPrompt');
const instructionsEl = document.getElementById('instructions');
const emailThreadEl = document.getElementById('emailThread');
const generateBtn = document.getElementById('generateBtn');
const resultEl = document.getElementById('result');
const clarifiedInstructionsEl = document.getElementById('clarifiedInstructions');
const copyBtn = document.getElementById('copyBtn');
const promptPreviewEl = document.getElementById('promptPreview');
const loadingEl = document.getElementById('loadingIndicator');
const recordBtn = document.getElementById('recordBtn');
const uploadBtn = document.getElementById('uploadBtn');
const audioFileInput = document.getElementById('audioFileInput');
const recordingStatusEl = document.getElementById('recordingStatus');
const themeToggle = document.getElementById('themeToggle');
const debugToggle = document.getElementById('debugToggle');
const debugContent = document.getElementById('debugContent');
const debugModeToggle = document.getElementById('debugModeToggle');
const debugPanel = document.querySelector('.debug-panel');
const langToggle = document.getElementById('langToggle');
const userNameEl = document.getElementById('userName');
const rememberNameBtn = document.getElementById('rememberNameBtn');

let currentLanguage = 'zh'; // 默认中文
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let recordStartTime = 0;
let lastDurationMs = 0;

// 翻译内容
const translations = {
    zh: {
        mainTitle: '📧 Email Voice Assistant',
        subtitle: '我相信，麦克风比键盘更加高效。我相信，重要的是你的想法，其余的都可以交给AI。',
        instructions: '指示',
        emailContent: '邮件内容',
        generatedReply: '生成的回复',
        debug: '🔧 调试',
        recordBtn: '🎙️ 长按录音',
        uploadBtn: '📁 上传音频',
        generateBtn: '✨ 生成回复',
        copyBtn: '📋 一键复制',
        debugMode: '🔧 调试模式',
        darkMode: '🌙 深色模式',
        lightMode: '☀️ 浅色模式',
        processing: '正在处理...',
        defaultInstructions: '请长按按钮开始录音，你只需要用最自然的口吻说出你想回复的内容，不要担心你表达中的重复、停顿和修正，AI会自动帮你整理要点并撰写邮件。',
        emailPlaceholder: '请输入完整的邮件内容，充分的上下文将帮助AI识别语音转文字中的错误，更清楚理解你的想法和写出更高质量的邮件回复。',
        replyPlaceholder: '生成的邮件回复会显示在这里...',
        namePlaceholder: '请输入你在邮件中的名字',
        rememberNameBtn: '记住我的名字',
        systemPromptTitle: '系统提示词',
        clarifiedTitle: '整理后的指令',
        previewTitle: '提示词预览',
        footerText: '语音转文字由Azure Speech Fast Transcription API支持，指令与邮件生成由Gpt-4.1模型支持',
        developerInfo: '开发者：Yi Shao | 欢迎在Teams上直接和我提供反馈',
    },
    en: {
        mainTitle: '📧 Email Voice Assistant',
        subtitle: 'Simply express your thoughts naturally, let AI handle the rest',
        instructions: 'Instructions',
        emailContent: 'Email Content',
        generatedReply: 'Generated Reply',
        debug: '🔧 Debug',
        recordBtn: '🎙️ Hold to Record',
        uploadBtn: '📁 Upload Audio',
        generateBtn: '✨ Generate Reply',
        copyBtn: '📋 Copy',
        debugMode: '🔧 Debug Mode',
        darkMode: '🌙 Dark Mode',
        lightMode: '☀️ Light Mode',
        processing: 'Processing...',
        defaultInstructions: 'Hold the button to start recording. Simply express what you want to reply with naturally. Don\'t worry about repetitions, pauses, or corrections - AI will automatically organize your thoughts and compose the email.',
        emailPlaceholder: 'Enter the complete email content. Sufficient context will help AI identify errors in voice-to-text conversion and better understand your intent for higher quality email responses.',
        replyPlaceholder: 'Generated email reply will be displayed here...',
        namePlaceholder: 'Enter your name',
        rememberNameBtn: 'Remember My Name',
        systemPromptTitle: 'System Prompt',
        clarifiedTitle: 'Clarified Instructions',
        previewTitle: 'Prompt Preview',
        footerText: 'Speech-to-Text powered by Azure Speech Fast Transcription API, Instructions and Email Generation powered by Gpt-4.1 model',
        developerInfo: 'Developer: Yi Shao | Welcome to provide feedback directly on Teams',
    }
};

// 语言切换函数
function changeLanguage(lang) {
    currentLanguage = lang;
    const t = translations[lang];
    
    // 更新页面标题和副标题
    document.querySelector('h1').textContent = t.mainTitle;
    document.querySelector('header p').textContent = t.subtitle;
    
    // 更新模块标题
    document.querySelectorAll('.instructions-panel h3')[0].textContent = t.instructions;
    document.querySelectorAll('.email-content-panel h3')[0].textContent = t.emailContent;
    document.querySelectorAll('.reply-panel h3')[0].textContent = t.generatedReply;
    document.querySelectorAll('.debug-panel .debug-header h3')[0].textContent = t.debug;
    
    // 更新按钮文字
    recordBtn.textContent = t.recordBtn;
    uploadBtn.textContent = t.uploadBtn;
    generateBtn.textContent = t.generateBtn;
    copyBtn.textContent = t.copyBtn;
    debugModeToggle.textContent = t.debugMode;
    themeToggle.textContent = document.body.classList.contains('dark-mode') ? t.lightMode : t.darkMode;
    langToggle.textContent = lang === 'zh' ? '🌐 English' : '🌐 中文';
    rememberNameBtn.textContent = t.rememberNameBtn;
    
    // 更新placeholder
    emailThreadEl.placeholder = t.emailPlaceholder;
    document.querySelector('.output-area .placeholder').textContent = t.replyPlaceholder;
    document.getElementById('userName').placeholder = t.namePlaceholder;
    
    // 更新footer
    document.getElementById('footerText').textContent = t.footerText;
    document.getElementById('developerInfo').textContent = t.developerInfo;
    
    // 更新默认文字
    DEFAULT_INSTRUCTIONS_TEXT = t.defaultInstructions;
    if (isDefaultInstructions) {
        instructionsEl.value = t.defaultInstructions;
    }
    
    // 更新加载指示器文字
    document.querySelector('.loading p').textContent = t.processing;
    
    // 更新DEFAULT_INSTRUCTIONS_TEXT用于focus/blur事件
    DEFAULT_INSTRUCTIONS_TEXT = t.defaultInstructions;
    
    // 保存语言选择
    localStorage.setItem('language', lang);
}

// 语言切换按钮事件
langToggle.addEventListener('click', () => {
    const newLang = currentLanguage === 'zh' ? 'en' : 'zh';
    changeLanguage(newLang);
});

// 默认指示文字
let DEFAULT_INSTRUCTIONS_TEXT = translations['zh'].defaultInstructions;
let isDefaultInstructions = true;

// 指示框的焦点和输入事件处理
instructionsEl.addEventListener('focus', () => {
    if (isDefaultInstructions && instructionsEl.value === DEFAULT_INSTRUCTIONS_TEXT) {
        instructionsEl.value = '';
        instructionsEl.classList.remove('default-text');
        instructionsEl.removeAttribute('style');
        isDefaultInstructions = false;
    }
});

instructionsEl.addEventListener('input', () => {
    if (isDefaultInstructions && instructionsEl.value !== DEFAULT_INSTRUCTIONS_TEXT) {
        isDefaultInstructions = false;
    }
    if (!isDefaultInstructions && instructionsEl.value === '') {
        // 用户清空了内容，仍然是非默认状态
    }
    localStorage.setItem('instructions', instructionsEl.value);
});

instructionsEl.addEventListener('blur', () => {
    if (instructionsEl.value === '') {
        instructionsEl.value = DEFAULT_INSTRUCTIONS_TEXT;
        instructionsEl.classList.add('default-text');
        instructionsEl.setAttribute('style', 'color: rgba(102, 102, 102, 0.5); font-style: italic;');
        isDefaultInstructions = true;
    }
});

// 邮件内容框的处理
emailThreadEl.addEventListener('input', () => {
    if (emailThreadEl.value.trim() === '') {
        emailThreadEl.classList.add('default-text');
    } else {
        emailThreadEl.classList.remove('default-text');
    }
    localStorage.setItem('emailThread', emailThreadEl.value);
});

emailThreadEl.addEventListener('blur', () => {
    if (emailThreadEl.value.trim() === '') {
        emailThreadEl.classList.add('default-text');
    }
});

// 调试面板折叠/展开
debugToggle.addEventListener('click', (e) => {
    e.preventDefault();
    debugContent.classList.toggle('collapsed');
    debugToggle.classList.toggle('collapsed');
    // 保存状态
    const isCollapsed = debugContent.classList.contains('collapsed');
    localStorage.setItem('debugCollapsed', isCollapsed);
});

// 初始化调试面板状态（默认折叠）
const debugCollapsed = localStorage.getItem('debugCollapsed') !== 'false';
if (debugCollapsed) {
    debugContent.classList.add('collapsed');
    debugToggle.classList.add('collapsed');
}

// 调试模式按钮
debugModeToggle.addEventListener('click', () => {
    debugPanel.classList.toggle('hidden');
    // 保存状态
    const isHidden = debugPanel.classList.contains('hidden');
    localStorage.setItem('debugModeHidden', isHidden);
});

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

// 文件上传功能
uploadBtn.addEventListener('click', () => {
    audioFileInput.click();
});

audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    recordingStatusEl.textContent = '处理音频中...';
    await transcribeAudio(file);
    
    // 重置文件输入，允许再次选择同一文件
    audioFileInput.value = '';
});

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
        
        // 如果当前是默认文字，清空并开始新的转录文本
        if (isDefaultInstructions && instructionsEl.value === DEFAULT_INSTRUCTIONS_TEXT) {
            instructionsEl.value = data.text;
        } else {
            // 否则，在现有文本后追加
            instructionsEl.value += (instructionsEl.value ? ' ' : '') + data.text;
        }
        
        // 移除默认文字样式
        instructionsEl.classList.remove('default-text');
        instructionsEl.removeAttribute('style');
        isDefaultInstructions = false;
        
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
    const userName = userNameEl.value.trim();

    if (!instructions || !emailThread) {
        alert('请填写指示和邮件内容');
        return;
    }

    // 显示加载状态
    loadingEl.classList.remove('hidden');
    generateBtn.disabled = true;
    // 清空结果文本，但保留 loading 元素
    Array.from(resultEl.children).forEach(child => {
        if (child.id !== 'loadingIndicator') {
            child.remove();
        }
    });
    // 清空直接文本节点
    resultEl.childNodes.forEach(node => {
        if (node.nodeType === 3) { // 文本节点
            node.remove();
        }
    });
    resultEl.classList.remove('has-content');
    clarifiedInstructionsEl.innerHTML = '';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instructions,
                emailThread,
                systemPrompt,
                userName
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

        // 显示整理后的指令
        if (data.clarifiedInstructions) {
            clarifiedInstructionsEl.textContent = data.clarifiedInstructions;
        } else {
            clarifiedInstructionsEl.innerHTML = '<p class="placeholder">未提供整理后的指令</p>';
        }

        // 显示邮件回复
        resultEl.textContent = data.text;
        // 移除placeholder和default-text样式，添加has-content类
        resultEl.classList.remove('default-text');
        resultEl.classList.add('has-content');
        const placeholders = resultEl.querySelectorAll('.placeholder');
        placeholders.forEach(el => el.remove());

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

// 记住用户名字
rememberNameBtn.addEventListener('click', () => {
    const nameValue = userNameEl.value.trim();
    if (nameValue) {
        localStorage.setItem('userName', nameValue);
        const originalText = rememberNameBtn.textContent;
        rememberNameBtn.textContent = '✓ 已保存';
        setTimeout(() => {
            rememberNameBtn.textContent = originalText;
        }, 2000);
    }
});

// 快捷键 (Ctrl+Enter)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        generateBtn.click();
    }
});

// 加载保存的数据 + 从后端加载默认系统提示词
// 使用DOMContentLoaded而不是load事件，避免闪烁
document.addEventListener('DOMContentLoaded', async () => {
    const savedSystemPrompt = localStorage.getItem('systemPrompt');
    const savedLanguage = localStorage.getItem('language') || 'zh';
    
    // 初始化语言
    changeLanguage(savedLanguage);

    // 指示框默认文字由HTML初始化，不需要在这里设置
    
    // 初始化邮件内容框的default-text类（提前执行以减少闪烁）
    if (emailThreadEl.value.trim() === '') {
        emailThreadEl.classList.add('default-text');
    } else {
        emailThreadEl.classList.remove('default-text');
    }
    
    // 恢复保存的用户名
    const savedUserName = localStorage.getItem('userName');
    if (savedUserName) {
        userNameEl.value = savedUserName;
    }
    
    // 如果有保存的系统提示词，使用保存的；否则从后端加载默认值
    if (savedSystemPrompt) {
        systemPromptEl.value = savedSystemPrompt;
    } else {
        try {
            const response = await fetch('/api/default-prompt');
            if (response.ok) {
                const data = await response.json();
                systemPromptEl.value = data.defaultPrompt;
            }
        } catch (error) {
            console.error('Failed to load default prompt:', error);
        }
    }
});

// 自动保存系统提示词
systemPromptEl.addEventListener('input', () => {
    localStorage.setItem('systemPrompt', systemPromptEl.value);
});
