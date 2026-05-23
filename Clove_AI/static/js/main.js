// ═══════════════════════════════════════════
//  CLOVE AI - MAIN INTERFACE LOGIC
// ═══════════════════════════════════════════

// Connect to the Flask server (for local mode)
const socket = (typeof io !== 'undefined') ? io(window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : undefined) : null;

// Dual-mode state (Local Socket.IO vs Cloud REST API)
const isLocalMode = () => socket && socket.connected;
const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '';

// ─── UNIFIED EMITTERS (Socket.IO with REST Fallback) ───

function emitAuthSession(userId) {
    if (isLocalMode()) {
        socket.emit('auth_session', { user_id: userId });
    } else {
        fetch(`${apiBase}/api/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        }).catch(err => console.error('Auth session sync failed:', err));
    }
}

function emitAuthLogin(email, password) {
    const btn = document.getElementById('login-btn');
    if (isLocalMode()) {
        socket.emit('auth_login', { email, password });
    } else {
        fetch(`${apiBase}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(res => res.json())
        .then(data => {
            if (btn) btn.classList.remove('loading');
            if (data.error) triggerAuthError(data);
            else completeAuth(data);
        })
        .catch(err => {
            if (btn) btn.classList.remove('loading');
            triggerAuthError({ message: "Cloud authentication server is offline or unreachable." });
        });
    }
}

function emitAuthSignup(name, email, password) {
    const btn = document.getElementById('signup-btn');
    if (isLocalMode()) {
        socket.emit('auth_signup', { name, email, password });
    } else {
        fetch(`${apiBase}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        })
        .then(res => res.json())
        .then(data => {
            if (btn) btn.classList.remove('loading');
            if (data.error) triggerAuthError(data);
            else completeAuth(data);
        })
        .catch(err => {
            if (btn) btn.classList.remove('loading');
            triggerAuthError({ message: "Cloud authentication server is offline or unreachable." });
        });
    }
}

function emitGetConversations() {
    if (isLocalMode()) {
        socket.emit('get_conversations');
    } else {
        fetch(`${apiBase}/api/conversations`)
        .then(res => res.json())
        .then(data => {
            currentSessionId = data.current_session_id;
            renderConversationsList(data.conversations, currentSessionId);
        })
        .catch(err => console.error('Failed to get conversations:', err));
    }
}

function emitNewConversation() {
    if (isLocalMode()) {
        socket.emit('new_conversation');
    } else {
        fetch(`${apiBase}/api/conversations/new`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            currentSessionId = data.session_id;
            renderConversationsList(data.conversations, currentSessionId);
            showWelcomeMessage();
        })
        .catch(err => console.error('Failed to create new conversation:', err));
    }
}

function emitSwitchConversation(sessionId) {
    if (isLocalMode()) {
        socket.emit('switch_conversation', { session_id: sessionId });
    } else {
        fetch(`${apiBase}/api/conversations/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        })
        .then(res => res.json())
        .then(data => {
            handleConversationHistory(data);
        })
        .catch(err => console.error('Failed to switch conversation:', err));
    }
}

function emitDeleteConversation(sessionId) {
    if (isLocalMode()) {
        socket.emit('delete_conversation', { session_id: sessionId });
    } else {
        fetch(`${apiBase}/api/conversations/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        })
        .then(res => res.json())
        .then(data => {
            currentSessionId = data.current_session_id;
            renderConversationsList(data.conversations, currentSessionId);
            handleConversationHistory(data);
        })
        .catch(err => console.error('Failed to delete conversation:', err));
    }
}

function emitGetConfig() {
    if (isLocalMode()) {
        socket.emit('get_config');
    } else {
        fetch(`${apiBase}/api/config`)
        .then(res => res.json())
        .then(config => {
            handleConfigData(config);
        })
        .catch(err => console.error('Failed to get config:', err));
    }
}

function emitUpdateConfig(updatedConfig) {
    if (isLocalMode()) {
        socket.emit('update_config', updatedConfig);
    } else {
        fetch(`${apiBase}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedConfig)
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) handleUpdateConfigError(data);
            else handleUpdateConfigSuccess(data);
        })
        .catch(err => {
            handleUpdateConfigError({ message: "Failed to connect to cloud config server." });
        });
    }
}

function emitUserCommand(cmd, attachments) {
    if (isLocalMode()) {
        socket.emit('user_command', { 
            command: cmd,
            attachments: attachments 
        });
    } else {
        // SSE streaming implementation for cloud backend
        fetch(`${apiBase}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd, attachments: attachments })
        })
        .then(async (response) => {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/event-stream')) {
                removePendingIndicator();
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    
                    // Keep the last partial line in the buffer
                    buffer = lines.pop();
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6).trim();
                            try {
                                const data = JSON.parse(jsonStr);
                                if (data.chunk) {
                                    handleChunk(data.chunk);
                                }
                                if (data.done) {
                                    finalizeChat(data);
                                }
                                if (data.error) {
                                    removePendingIndicator();
                                    addMessage('AI Error: ' + data.error, 'ai');
                                }
                            } catch (err) {
                                console.error('Error parsing SSE line:', err, jsonStr);
                            }
                        }
                    }
                }
            } else {
                // Non-streaming response (quick action command or fallback)
                const data = await response.json();
                removePendingIndicator();
                addMessage(data.message, 'ai');
                if (data.mode) {
                    handleModeBadge(data.mode);
                }
            }
        })
        .catch(err => {
            removePendingIndicator();
            addMessage('Error: Failed to reach the cloud AI backend.', 'ai');
            console.error(err);
        });
    }
}

// ─── AUTHENTICATION LOGIC ───
const authOverlay = document.getElementById('auth-overlay');
const loginCard = document.getElementById('login-card');
const signupCard = document.getElementById('signup-card');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');
const signupError = document.getElementById('signup-error');

function toggleAuth(mode) {
    if (mode === 'signup') {
        loginCard.style.display = 'none';
        signupCard.style.display = 'block';
    } else {
        loginCard.style.display = 'block';
        signupCard.style.display = 'none';
    }
}

// Check for existing session on load
window.addEventListener('DOMContentLoaded', () => {
    const session = localStorage.getItem('clove_session');
    if (session) {
        const userData = JSON.parse(session);
        completeAuth(userData);
    }
});

function completeAuth(userData) {
    console.log('[AUTH] Completing auth for:', userData.email);
    localStorage.setItem('clove_session', JSON.stringify(userData));
    
    // Ensure the overlay is hidden immediately
    if (authOverlay) authOverlay.style.display = 'none';
    
    // Update Profile UI safely
    try {
        const nameEl = document.getElementById('display-name');
        const avatarEl = document.getElementById('user-avatar');
        
        if (nameEl) nameEl.textContent = userData.name || 'User';
        if (avatarEl) avatarEl.textContent = (userData.name || 'U').charAt(0).toUpperCase();

        // Update Popover elements
        const popoverNameEl = document.getElementById('popover-name');
        const popoverEmailEl = document.getElementById('popover-email');
        const popoverAvatarEl = document.getElementById('popover-avatar');
        
        if (popoverNameEl) popoverNameEl.textContent = userData.name || 'User';
        if (popoverEmailEl) popoverEmailEl.textContent = userData.email || 'user@example.com';
        if (popoverAvatarEl) popoverAvatarEl.textContent = (userData.name || 'U').charAt(0).toUpperCase();
    } catch (e) {
        console.error('[AUTH] UI Update Error:', e);
    }
    
    // Notify backend of user session
    emitAuthSession(userData.id);
    emitGetConversations();
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    
    btn.classList.add('loading');
    authError.style.display = 'none';
    
    emitAuthLogin(email, password);
});

signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const btn = document.getElementById('signup-btn');
    
    btn.classList.add('loading');
    signupError.style.display = 'none';
    
    emitAuthSignup(name, email, password);
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('clove_session');
        location.reload();
    });
}

const popoverLogoutBtn = document.getElementById('popover-logout-btn');
if (popoverLogoutBtn) {
    popoverLogoutBtn.addEventListener('click', () => {
        localStorage.removeItem('clove_session');
        location.reload();
    });
}

function triggerAuthError(data) {
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    if (loginBtn) loginBtn.classList.remove('loading');
    if (signupBtn) signupBtn.classList.remove('loading');
    
    let message = data.message || "An authentication error occurred.";
    if (message.toLowerCase().includes('rate limit')) {
        message = "Rate limit exceeded. Please wait a few minutes, or disable 'Email Confirmation' in your Supabase Auth settings to skip this check.";
    } else if (message.toLowerCase().includes('confirm') || message.toLowerCase().includes('confirmation')) {
        message = "Please check your email and confirm your address before signing in, or disable 'Confirm email' in your Supabase Auth settings.";
    } else if (message.toLowerCase().includes('invalid login credentials')) {
        message = "Invalid email or password. Please verify your credentials or sign up if you don't have an account.";
    }
    
    if (loginCard && loginCard.style.display !== 'none') {
        if (authError) {
            authError.textContent = message;
            authError.style.display = 'block';
        }
    } else {
        if (signupError) {
            signupError.textContent = message;
            signupError.style.display = 'block';
        }
    }
}

// Socket Auth Responses (Only if socket exists)
if (socket) {
    socket.on('auth_success', (data) => {
        completeAuth(data);
    });

    socket.on('auth_error', (data) => {
        triggerAuthError(data);
    });
}

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const lastHeard = document.getElementById('last-heard');
const voiceIndicator = document.getElementById('voice-indicator');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');

// Toggle Emoji Picker
emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('active');
    // Hide attachment menu if open
    const attachmentMenu = document.getElementById('attachment-menu');
    if (attachmentMenu) attachmentMenu.classList.remove('active');
});

// Close pickers when clicking outside
document.addEventListener('click', () => {
    if (emojiPicker) emojiPicker.classList.remove('active');
    const attachmentMenu = document.getElementById('attachment-menu');
    if (attachmentMenu) attachmentMenu.classList.remove('active');
});

function addEmoji(emoji) {
    userInput.value += emoji;
    userInput.focus();
}

// ─── Pipeline Debugging ───
function logPipeline(stage, data = '') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`%c[${timestamp}] [VOICE-PIPELINE] ${stage}:`, 'color: #10b981; font-weight: bold;', data);
}

// ─── Connection Status Monitoring ───
function updateConnectionStatus(isConnected) {
    console.log('[SOCKET] Connection status updated:', isConnected ? 'ONLINE' : 'OFFLINE');
    const connStatus = document.getElementById('conn-status');
    const loginConnError = document.getElementById('login-conn-error');
    const signupConnError = document.getElementById('signup-conn-error');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    
    // Check if hosted on cloud (e.g. Vercel)
    const isCloud = window.location.protocol !== 'file:';
    
    if (isConnected || isCloud) {
        if (connStatus) {
            connStatus.className = 'connection-badge online';
            connStatus.innerHTML = isCloud ? '<span class="badge-dot"></span>CLOUD' : '<span class="badge-dot"></span>ONLINE';
            if (isCloud) {
                connStatus.style.background = 'rgba(59, 130, 246, 0.15)';
                connStatus.style.color = '#60a5fa';
                connStatus.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            } else {
                connStatus.style.background = '';
                connStatus.style.color = '';
                connStatus.style.borderColor = '';
            }
        }
        if (loginConnError) loginConnError.style.display = 'none';
        if (signupConnError) signupConnError.style.display = 'none';
        if (loginBtn) loginBtn.removeAttribute('disabled');
        if (signupBtn) signupBtn.removeAttribute('disabled');
    } else {
        if (connStatus) {
            connStatus.className = 'connection-badge offline';
            connStatus.innerHTML = '<span class="badge-dot"></span>OFFLINE';
        }
        const offlineMessage = '<i class="fas fa-plug-circle-xmark"></i> Clove backend offline. Run <code>python app.py</code> to connect.';
        if (loginConnError) {
            loginConnError.innerHTML = offlineMessage;
            loginConnError.style.display = 'block';
        }
        if (signupConnError) {
            signupConnError.innerHTML = offlineMessage;
            signupConnError.style.display = 'block';
        }
        if (loginBtn) {
            loginBtn.setAttribute('disabled', 'true');
            loginBtn.classList.remove('loading');
        }
        if (signupBtn) {
            signupBtn.setAttribute('disabled', 'true');
            signupBtn.classList.remove('loading');
        }
    }
}

// ─── Socket / REST Events Integration ───
if (socket) {
    socket.on('connect', () => {
        console.log('[SOCKET] Connected to server');
        updateConnectionStatus(true);
        emitGetConversations();
    });

    socket.on('disconnect', () => {
        console.log('[SOCKET] Disconnected from server');
        updateConnectionStatus(false);
    });

    socket.on('connect_error', (error) => {
        console.warn('[SOCKET] Connection error:', error);
        updateConnectionStatus(false);
    });
}

// Initialize status on load
window.addEventListener('DOMContentLoaded', () => {
    updateConnectionStatus(socket && socket.connected);
});

// Telemetry Polling fallback for Cloud Mode
setInterval(() => {
    if (!isLocalMode() && window.location.protocol !== 'file:') {
        fetch(`${apiBase}/api/system_stats`)
        .then(res => res.json())
        .then(data => {
            handleSystemStats(data);
        })
        .catch(err => {});
    }
}, 5000);

function handleSystemStats(data) {
    if (!data) return;
    if (document.getElementById('cpu-val')) document.getElementById('cpu-val').textContent = `${Math.round(data.cpu)}%`;
    if (document.getElementById('ram-val')) document.getElementById('ram-val').textContent = `${Math.round(data.ram)}%`;
    if (document.getElementById('battery-val')) document.getElementById('battery-val').textContent = `${Math.round(data.battery.percent)}%`;
    if (document.getElementById('disk-val')) document.getElementById('disk-val').textContent = `${Math.round(data.disk)}%`;
    if (document.getElementById('cpu-bar')) document.getElementById('cpu-bar').style.width = `${data.cpu}%`;
    if (document.getElementById('ram-bar')) document.getElementById('ram-bar').style.width = `${data.ram}%`;
    if (document.getElementById('battery-bar')) document.getElementById('battery-bar').style.width = `${data.battery.percent}%`;
    if (document.getElementById('disk-bar')) document.getElementById('disk-bar').style.width = `${data.disk}%`;
}

if (socket) {
    socket.on('system_stats', (data) => {
        handleSystemStats(data);
    });
}

function handleModeBadge(mode) {
    logPipeline('MODE-CHANGE', mode);
    const badge = document.getElementById('mode-badge');
    if (badge) {
        if (mode === 'coding') {
            badge.style.display = 'flex';
            badge.textContent = 'CODING MODE';
            badge.style.background = 'rgba(255, 255, 255, 0.08)';
            badge.style.color = 'var(--accent-white)';
            badge.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        } else {
            badge.style.display = 'none';
        }
    }
}

if (socket) {
    socket.on('mode_change', (data) => {
        handleModeBadge(data.mode);
    });
}

let currentStreamingMessage = null;

function handleChunk(chunk) {
    removePendingIndicator();
    if (!currentStreamingMessage) {
        currentStreamingMessage = createAIPlaceholder();
    }
    const contentDiv = currentStreamingMessage.querySelector('.msg-content');
    const fullText = (contentDiv.getAttribute('data-raw-text') || '') + chunk;
    contentDiv.setAttribute('data-raw-text', fullText);
    try {
        contentDiv.innerHTML = marked.parse(fullText, { breaks: true });
    } catch (e) {
        contentDiv.textContent = fullText;
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

if (socket) {
    socket.on('ai_chunk', (data) => {
        handleChunk(data.chunk);
    });
}

if (socket) {
    socket.on('audio_response', (data) => {
        if (data.audio) {
            logPipeline('PREMIUM-AUDIO-RECEIVED');
            playBase64Audio(data.audio);
        }
    });
}

function playBase64Audio(base64) {
    const audioSrc = `data:audio/mp3;base64,${base64}`;
    const audio = new Audio(audioSrc);
    
    if (recognition) recognition.stop();
    isAISpeaking = true;

    audio.onended = () => {
        logPipeline('PREMIUM-AUDIO-FINISHED');
        isAISpeaking = false;
        if (isVoiceModeActive && recognition) {
            recognition.start();
        }
    };

    audio.play().catch(e => console.error('Audio playback failed:', e));
}

function finalizeChat(data) {
    removePendingIndicator();
    if (currentStreamingMessage) {
        const contentDiv = currentStreamingMessage.querySelector('.msg-content');
        const rawText = contentDiv.getAttribute('data-raw-text') || '';
        try {
            contentDiv.innerHTML = marked.parse(rawText, { breaks: true });
        } catch (e) {
            contentDiv.textContent = rawText;
        }
        currentStreamingMessage = null;
    }
    if (data.title_updated && data.conversations) {
        renderConversationsList(data.conversations, data.current_session_id);
    }
}

if (socket) {
    socket.on('ai_response', (data) => {
        logPipeline('RESPONSE-FINISHED', data.message.substring(0, 50) + '...');
        removePendingIndicator();
        if (currentStreamingMessage) {
            const contentDiv = currentStreamingMessage.querySelector('.msg-content');
            try {
                contentDiv.innerHTML = marked.parse(data.message, { breaks: true });
            } catch (e) {
                contentDiv.textContent = data.message;
            }
            currentStreamingMessage = null;
        } else {
            addMessage(data.message, 'ai');
        }
    });
}

// ─── Chat Session / History Management ───
let currentSessionId = null;

// Helper to escape HTML in titles
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper to show the welcome/greeting message
function showWelcomeMessage() {
    if (!chatContainer) return;
    chatContainer.innerHTML = `
        <div class="message msg-ai">
            <div class="msg-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
            </div>
            <div class="msg-content">
                Hey! I'm <strong>Clove</strong>, your AI assistant. I can help you with questions, open apps, control your system, and more. What can I do for you?
            </div>
        </div>
    `;
}

// Render the sidebar history list
function renderConversationsList(list, activeId) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    historyList.innerHTML = '';

    list.forEach(conv => {
        const item = document.createElement('div');
        item.className = `history-item${conv.id === activeId ? ' active' : ''}`;
        item.setAttribute('data-id', conv.id);
        item.onclick = () => switchConversation(conv.id);

        item.innerHTML = `
            <div class="history-item-content">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>${escapeHtml(conv.title)}</span>
            </div>
            <button class="delete-btn" onclick="deleteConversation('${conv.id}', event)" title="Delete conversation">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        historyList.appendChild(item);
    });
}

function startNewChat() {
    emitNewConversation();
}

function switchConversation(sessionId) {
    if (sessionId === currentSessionId) return;
    emitSwitchConversation(sessionId);
}

function deleteConversation(sessionId, event) {
    if (event) event.stopPropagation();
    if (confirm("Are you sure you want to delete this chat session?")) {
        emitDeleteConversation(sessionId);
    }
}

// Expose functions globally for inline HTML click handlers
window.startNewChat = startNewChat;
window.switchConversation = switchConversation;
window.deleteConversation = deleteConversation;

function handleConversationHistory(data) {
    console.log('[CONVERSATIONS] Received history for:', data.session_id);
    if (data.session_id) {
        currentSessionId = data.session_id;
    }
    
    // Update active highlight in sidebar list
    document.querySelectorAll('.history-item').forEach(item => {
        if (item.getAttribute('data-id') === currentSessionId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    if (!chatContainer) return;
    chatContainer.innerHTML = '';
    
    if (!data.history || data.history.length === 0) {
        showWelcomeMessage();
    } else {
        data.history.forEach(msg => {
            addMessage(msg.content, msg.role);
        });
    }
}

// Socket handlers for conversation lifecycle
if (socket) {
    socket.on('conversations_list', (data) => {
        console.log('[CONVERSATIONS] Received list:', data);
        currentSessionId = data.current_session_id;
        renderConversationsList(data.conversations, currentSessionId);
    });

    socket.on('new_conversation_created', (data) => {
        console.log('[CONVERSATIONS] New session created:', data.session_id);
        currentSessionId = data.session_id;
        renderConversationsList(data.conversations, currentSessionId);
    });

    socket.on('conversation_history', (data) => {
        handleConversationHistory(data);
    });
}

function createAIPlaceholder() {
    if (!chatContainer) return null;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message msg-ai`;
    
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = 'C';
    msgDiv.appendChild(avatar);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'msg-content';
    msgDiv.appendChild(contentDiv);
    
    chatContainer.appendChild(msgDiv);
    return msgDiv;
}

// ─── File Attachment State & Helpers ───
let selectedAttachments = [];

function toggleAttachmentMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('attachment-menu');
    if (menu) {
        menu.classList.toggle('active');
        // Hide emoji picker if open
        if (emojiPicker) emojiPicker.classList.remove('active');
    }
}

window.toggleAttachmentMenu = toggleAttachmentMenu;
window.triggerFilePicker = triggerFilePicker;

function triggerFilePicker(type = 'all') {
    // Hide attachment menu
    const menu = document.getElementById('attachment-menu');
    if (menu) menu.classList.remove('active');

    // Create a dynamic input element for the specific type to ensure correct browser dialog filters
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';

    // Set filter based on type
    if (type === 'document') {
        fileInput.accept = ".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.rtf,.html,.css,.js,.json,.py,.md,.ts,.tsx,.jsx,.xml";
    } else if (type === 'photo') {
        fileInput.accept = "image/*";
    } else if (type === 'video') {
        fileInput.accept = "video/*";
    }

    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e);
        // Clean up input after selection
        fileInput.remove();
    });

    document.body.appendChild(fileInput);
    fileInput.click();
}

function handleFileSelection(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Prevent duplicate files (by name and size)
        if (selectedAttachments.some(f => f.name === file.name && f.size === file.size)) {
            continue;
        }

        const reader = new FileReader();
        
        // Determine file type category
        let type = 'other';
        if (file.type.startsWith('image/')) {
            type = 'image';
            reader.readAsDataURL(file); // Reads as base64 data URL
        } else if (
            file.type.startsWith('text/') || 
            file.name.endsWith('.js') || 
            file.name.endsWith('.py') || 
            file.name.endsWith('.json') || 
            file.name.endsWith('.html') || 
            file.name.endsWith('.css') || 
            file.name.endsWith('.md') ||
            file.name.endsWith('.ts') ||
            file.name.endsWith('.tsx') ||
            file.name.endsWith('.jsx')
        ) {
            type = 'text';
            reader.readAsText(file); // Reads content as text
        } else {
            // Other files: just read metadata
            selectedAttachments.push({
                name: file.name,
                size: file.size,
                type: 'other',
                mime_type: file.type
            });
            updateAttachmentUI();
            continue;
        }

        reader.onload = function(event) {
            let content = event.target.result;
            if (type === 'image') {
                // Strip the data URL prefix to get raw base64
                content = content.split(',')[1];
            }
            selectedAttachments.push({
                name: file.name,
                size: file.size,
                type: type,
                mime_type: file.type,
                content: content
            });
            updateAttachmentUI();
        };
    }
    
    // Clear input value so selecting the same file again triggers change event
    e.target.value = '';
}

function updateAttachmentUI() {
    const container = document.getElementById('attachment-preview-container');
    if (!container) return;

    if (selectedAttachments.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = '';

    selectedAttachments.forEach((file, index) => {
        const tag = document.createElement('div');
        tag.className = 'attachment-tag';

        // Select FontAwesome icon
        let iconClass = 'fa-file';
        if (file.type === 'image') {
            iconClass = 'fa-file-image';
        } else if (file.type === 'text') {
            iconClass = 'fa-file-code';
        } else if (file.mime_type && file.mime_type.includes('pdf')) {
            iconClass = 'fa-file-pdf';
        } else if (file.mime_type && (file.mime_type.includes('word') || file.mime_type.includes('office'))) {
            iconClass = 'fa-file-word';
        }

        tag.innerHTML = `
            <i class="fas ${iconClass} file-icon ${file.type}"></i>
            <span>${file.name}</span>
            <span class="remove-btn" onclick="removeAttachment(${index}, event)">
                <i class="fas fa-times"></i>
            </span>
        `;
        container.appendChild(tag);
    });
}

function removeAttachment(index, event) {
    if (event) event.stopPropagation();
    selectedAttachments.splice(index, 1);
    updateAttachmentUI();
}

// ─── Input Handling ───
function submitInput() {
    if (!userInput) return;
    const cmd = userInput.value.trim();
    if (cmd || selectedAttachments.length > 0) {
        console.log('User input detected:', cmd, 'attachments:', selectedAttachments);
        
        // Stop listening if mic is active when sending
        if (typeof stopMic === 'function' && isListening) {
            stopMic();
        }

        sendCommand(cmd);
        userInput.value = '';
    }
}

if (userInput) {
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitInput();
        }
    });
}

if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitInput();
    });
}

function sendCommand(cmd, isSilent = false) {
    logPipeline('SENDING-COMMAND', cmd);
    
    // Format message display with attachments list
    if (!isSilent) {
        let displayMsg = cmd;
        if (selectedAttachments.length > 0) {
            if (displayMsg) displayMsg += "\n\n";
            displayMsg += "**Attached Files:**\n" + selectedAttachments.map(f => `📄 ${f.name}`).join('\n');
        }
        addMessage(displayMsg, 'user');
    }
    
    showPendingIndicator();
    emitUserCommand(cmd, selectedAttachments);
    
    // Reset attachments
    selectedAttachments = [];
    updateAttachmentUI();
}

// ─── Message Rendering ───
function addMessage(text, role) {
    if (!chatContainer) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message msg-${role}`;
    
    if (role === 'ai') {
        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = 'C';
        msgDiv.appendChild(avatar);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'msg-content';
        try {
            contentDiv.innerHTML = marked.parse(text, { breaks: true });
        } catch (e) {
            contentDiv.textContent = text;
        }
        msgDiv.appendChild(contentDiv);
    } else {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'msg-content';
        try {
            contentDiv.innerHTML = marked.parse(text, { breaks: true });
        } catch (e) {
            contentDiv.textContent = text;
        }
        msgDiv.appendChild(contentDiv);
    }
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showPendingIndicator() {
    if (!chatContainer) return;
    const indicator = document.createElement('div');
    indicator.id = 'pending-indicator';
    indicator.className = 'message msg-ai';
    indicator.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removePendingIndicator() {
    const indicator = document.getElementById('pending-indicator');
    if (indicator) indicator.remove();
}

// ─── Voice Interaction (Backend Python-Driven & Browser-Speech fallback) ───
let isListening = false;
let browserRecognizer = null;

// SVG icons for mic states
const MIC_ICON_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';
const STOP_ICON_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';

function cleanupBrowserMic() {
    isListening = false;
    if (micBtn) {
        micBtn.classList.remove('listening');
        micBtn.innerHTML = MIC_ICON_SVG;
    }
    browserRecognizer = null;
}

function startMic() {
    if (isLocalMode()) {
        console.log('[MIC] Requesting backend to start mic...');
        socket.emit('start_mic');
    } else {
        // Use browser Web Speech API for Cloud/Vercel Mode
        console.log('[MIC] Initializing browser-based speech recognition...');
        
        // 1. Check for secure context (HTTPS/localhost is required for browser speech recognition)
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            alert("🎙️ Microphone access requires a secure connection (HTTPS). Please ensure you are visiting the HTTPS version of the site.");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("🎙️ Your browser does not support native speech recognition. Please use Google Chrome, Edge, or Safari.");
            return;
        }

        try {
            // Provide instant visual UI feedback immediately upon clicking
            isListening = true;
            if (micBtn) {
                micBtn.classList.add('listening');
                micBtn.innerHTML = STOP_ICON_SVG;
            }

            browserRecognizer = new SpeechRecognition();
            browserRecognizer.continuous = false;
            browserRecognizer.interimResults = false;
            browserRecognizer.lang = 'en-US';

            browserRecognizer.onstart = () => {
                console.log('[MIC] 🟢 Browser SpeechRecognition: onstart (session active)');
            };

            browserRecognizer.onaudiostart = () => {
                console.log('[MIC] 🎤 Browser SpeechRecognition: onaudiostart (capturing audio)');
            };

            browserRecognizer.onsoundstart = () => {
                console.log('[MIC] 🔊 Browser SpeechRecognition: onsoundstart (sound detected)');
            };

            browserRecognizer.onspeechstart = () => {
                console.log('[MIC] 🗣️ Browser SpeechRecognition: onspeechstart (speech detected)');
            };

            browserRecognizer.onspeechend = () => {
                console.log('[MIC] 🤫 Browser SpeechRecognition: onspeechend (speech ended)');
            };

            browserRecognizer.onsoundend = () => {
                console.log('[MIC] 🔇 Browser SpeechRecognition: onsoundend (sound ended)');
            };

            browserRecognizer.onaudioend = () => {
                console.log('[MIC] 🛑 Browser SpeechRecognition: onaudioend (audio capture ended)');
            };

            browserRecognizer.onresult = (event) => {
                const text = event.results[0][0].transcript;
                console.log('[MIC] 📝 Browser SpeechRecognition: onresult:', text);
                if (text && userInput) {
                    const existingText = userInput.value.trim();
                    userInput.value = existingText ? existingText + ' ' + text : text;
                    userInput.focus();
                    userInput.selectionStart = userInput.selectionEnd = userInput.value.length;
                }
            };

            browserRecognizer.onerror = (event) => {
                console.warn('[MIC] ❌ Browser SpeechRecognition: onerror:', event.error);
                if (event.error === 'not-allowed') {
                    alert('🎙️ Microphone access was blocked. Please enable microphone permissions in your browser settings.');
                } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    alert('🎙️ Microphone Error: ' + event.error);
                }
                cleanupBrowserMic();
            };

            browserRecognizer.onend = () => {
                console.log('[MIC] Browser speech recognition ended');
                cleanupBrowserMic();
            };

            browserRecognizer.start();
        } catch (err) {
            console.error('Failed to start browser mic:', err);
            alert('🎙️ Failed to start microphone.');
            cleanupBrowserMic();
        }
    }
}

function stopMic() {
    if (isLocalMode()) {
        console.log('[MIC] Requesting backend to stop mic...');
        socket.emit('stop_mic');
    } else {
        if (browserRecognizer) {
            try {
                browserRecognizer.stop();
            } catch(e) {}
            cleanupBrowserMic();
        }
    }
}

// Socket handlers for mic
if (socket) {
    socket.on('mic_started', () => {
        console.log('[MIC] ✅ Backend listening started');
        isListening = true;
        if (micBtn) {
            micBtn.classList.add('listening');
            micBtn.innerHTML = STOP_ICON_SVG;
        }
    });

    socket.on('mic_stopped', () => {
        console.log('[MIC] 🛑 Backend listening stopped');
        isListening = false;
        if (micBtn) {
            micBtn.classList.remove('listening');
            micBtn.innerHTML = MIC_ICON_SVG;
        }
    });

    socket.on('mic_result', (data) => {
        console.log('[MIC] 📝 Result received:', data.text);
        if (data.text && userInput) {
            const existingText = userInput.value.trim();
            if (existingText) {
                userInput.value = existingText + ' ' + data.text;
            } else {
                userInput.value = data.text;
            }
            userInput.focus();
            userInput.selectionStart = userInput.selectionEnd = userInput.value.length;
        }
    });

    socket.on('mic_error', (data) => {
        console.warn('[MIC] ❌ Error:', data.error);
        if (data.error === 'unknown' || data.error === 'Could not understand audio.') {
            console.log('[MIC] No speech recognized.');
        } else if (data.error !== 'No speech detected.') {
            alert('🎙️ Microphone Error: ' + data.error);
        }
    });
}

// Attach click handler to mic button
if (micBtn) {
    console.log('[MIC] ✅ Mic button found, attaching click handler.');
    micBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[MIC] Clicked. isListening:', isListening);
        if (isListening) {
            stopMic();
        } else {
            startMic();
        }
    });
} else {
    console.error('[MIC] ❌ Mic button #mic-btn NOT found in the DOM!');
}

// ─── Hotkey: Ctrl + Space ───
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        if (isListening) {
            stopMic();
        } else {
            startMic();
        }
    }
});

let isVoiceModeActive = false;
let isAISpeaking = false;

function toggleVoiceMode() {}
function speakResponse(text) {}

// ─── Clock ───
function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('live-clock');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString([], { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ─── Top Bar In-Chat Search ───
let searchMatches = [];
let currentMatchIndex = -1;

function handleTopBarSearchClick(event) {
    if (event) event.stopPropagation();
    const container = document.getElementById('top-bar-search-container');
    const input = document.getElementById('top-bar-search-input');
    if (!container || !input) return;

    if (container.classList.contains('active')) {
        // Close search and clear highlights
        clearSearchHighlights();
        container.classList.remove('active');
        input.value = '';
        updateSearchUI(0, -1);
    } else {
        // Expand and focus
        container.classList.add('active');
        setTimeout(() => input.focus(), 100);
    }
}

window.handleTopBarSearchClick = handleTopBarSearchClick;

function performChatSearch(query) {
    clearSearchHighlights();
    searchMatches = [];
    currentMatchIndex = -1;

    if (!query || !chatContainer) {
        updateSearchUI(0, -1);
        return;
    }

    const messages = chatContainer.querySelectorAll('.msg-content');
    const lowerQuery = query.toLowerCase();

    messages.forEach(msgEl => {
        // Walk text nodes to find and wrap matches
        const walker = document.createTreeWalker(msgEl, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(node => {
            const text = node.textContent;
            const lower = text.toLowerCase();
            let idx = lower.indexOf(lowerQuery);
            if (idx === -1) return;

            // Split this text node into fragments with <mark> wrappers
            const frag = document.createDocumentFragment();
            let lastIdx = 0;

            while (idx !== -1) {
                // Text before match
                if (idx > lastIdx) {
                    frag.appendChild(document.createTextNode(text.substring(lastIdx, idx)));
                }
                // The match
                const mark = document.createElement('mark');
                mark.className = 'search-highlight';
                mark.textContent = text.substring(idx, idx + query.length);
                frag.appendChild(mark);
                searchMatches.push(mark);

                lastIdx = idx + query.length;
                idx = lower.indexOf(lowerQuery, lastIdx);
            }

            // Remaining text after last match
            if (lastIdx < text.length) {
                frag.appendChild(document.createTextNode(text.substring(lastIdx)));
            }

            node.parentNode.replaceChild(frag, node);
        });
    });

    if (searchMatches.length > 0) {
        currentMatchIndex = 0;
        searchMatches[0].classList.add('active-match');
        searchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updateSearchUI(searchMatches.length, currentMatchIndex);
}

function navigateSearchMatch(direction, event) {
    if (event) event.stopPropagation();
    if (searchMatches.length === 0) return;

    // Remove active class from current
    if (currentMatchIndex >= 0) {
        searchMatches[currentMatchIndex].classList.remove('active-match');
    }

    // Move index
    currentMatchIndex += direction;
    if (currentMatchIndex >= searchMatches.length) currentMatchIndex = 0;
    if (currentMatchIndex < 0) currentMatchIndex = searchMatches.length - 1;

    // Highlight and scroll to new active
    searchMatches[currentMatchIndex].classList.add('active-match');
    searchMatches[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });

    updateSearchUI(searchMatches.length, currentMatchIndex);
}

window.navigateSearchMatch = navigateSearchMatch;

function clearSearchHighlights() {
    if (!chatContainer) return;
    const marks = chatContainer.querySelectorAll('mark.search-highlight');
    marks.forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize(); // Merge adjacent text nodes
    });
    searchMatches = [];
    currentMatchIndex = -1;
}

function updateSearchUI(total, activeIdx) {
    const counter = document.getElementById('search-match-counter');
    const prevBtn = document.getElementById('search-prev-btn');
    const nextBtn = document.getElementById('search-next-btn');

    if (total > 0) {
        if (counter) {
            counter.textContent = `${activeIdx + 1}/${total}`;
            counter.style.display = 'inline';
        }
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
    } else {
        if (counter) {
            const input = document.getElementById('top-bar-search-input');
            counter.textContent = (input && input.value.trim()) ? '0/0' : '';
            counter.style.display = (input && input.value.trim()) ? 'inline' : 'none';
        }
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }
}

// Live search as user types + Enter to jump to next
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('top-bar-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            performChatSearch(e.target.value.trim());
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (searchMatches.length > 0) {
                    navigateSearchMatch(e.shiftKey ? -1 : 1, null);
                }
            }
            if (e.key === 'Escape') {
                clearSearchHighlights();
                const container = document.getElementById('top-bar-search-container');
                if (container) container.classList.remove('active');
                searchInput.value = '';
                updateSearchUI(0, -1);
            }
        });

        searchInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
});

// Collapse search bar on outside click
document.addEventListener('click', (e) => {
    const container = document.getElementById('top-bar-search-container');
    if (container && container.classList.contains('active')) {
        if (!container.contains(e.target)) {
            clearSearchHighlights();
            container.classList.remove('active');
            const input = document.getElementById('top-bar-search-input');
            if (input) input.value = '';
            updateSearchUI(0, -1);
        }
    }
});

// ─── Profile Popover & Floating Settings Modal ───
function toggleProfilePopover(event) {
    if (event) event.stopPropagation();
    const popover = document.getElementById('profile-popover');
    if (popover) {
        const isCurrentlyOpen = popover.style.display === 'flex';
        popover.style.display = isCurrentlyOpen ? 'none' : 'flex';
    }
}

// Close popover when clicking anywhere else on screen
document.addEventListener('click', () => {
    const popover = document.getElementById('profile-popover');
    if (popover) popover.style.display = 'none';
});

function openSettingsModal() {
    // Hide popover if open
    const popover = document.getElementById('profile-popover');
    if (popover) popover.style.display = 'none';

    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.display = 'flex';
        emitGetConfig();
    }
}

function closeSettingsModal(event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

function openHelp() {
    // Hide popover if open
    const popover = document.getElementById('profile-popover');
    if (popover) popover.style.display = 'none';
    
    alert("Clove AI Support & Help Documentation is coming soon!");
}

// ─── Tab Switching ───
function switchTab(tabName) {
    if (tabName === 'settings') {
        openSettingsModal();
        return;
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelectorAll(`[data-tab]`).forEach(item => {
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        }
    });

    const chatPanel = document.getElementById('chat-panel');
    if (chatPanel) chatPanel.style.display = 'flex';

    const historySidebar = document.getElementById('history-sidebar');
    if (historySidebar) {
        if (tabName === 'logs') {
            const isCurrentlyShown = historySidebar.style.display === 'flex';
            if (isCurrentlyShown) {
                // If already open, clicking History again hides it
                historySidebar.style.display = 'none';
                document.querySelector('[data-tab="logs"]').classList.remove('active');
                document.querySelector('[data-tab="chat"]').classList.add('active');
            } else {
                // Open history sidebar and refresh the conversations list
                historySidebar.style.display = 'flex';
                emitGetConversations();
            }
        } else if (tabName === 'chat') {
            // Clicking Chat tab directly closes history sidebar for a full-width experience
            historySidebar.style.display = 'none';
        }
    }
}

// ─── Password Field Visibility Toggle ───
function togglePasswordVisibility(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    const btn = input.nextElementSibling;
    const icon = btn ? btn.querySelector('i') : null;
    
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

// ─── Settings Form & Socket Handlers ───
const settingsForm = document.getElementById('settings-form');
const settingsStatus = document.getElementById('settings-status-msg');

function handleConfigData(config) {
    console.log('[SETTINGS] Received config data');
    if (document.getElementById('pref-gemini-key')) document.getElementById('pref-gemini-key').value = config.gemini_api_key || '';
    if (document.getElementById('pref-assistant-name')) document.getElementById('pref-assistant-name').value = config.assistant_name || 'Clove';
    if (document.getElementById('pref-eleven-key')) document.getElementById('pref-eleven-key').value = config.elevenlabs_api_key || '';
    if (document.getElementById('pref-voice-id')) document.getElementById('pref-voice-id').value = config.voice_id || '';
    if (document.getElementById('pref-supabase-url')) document.getElementById('pref-supabase-url').value = config.supabase_url || '';
    if (document.getElementById('pref-supabase-key')) document.getElementById('pref-supabase-key').value = config.supabase_key || '';
}

if (socket) {
    socket.on('config_data', (config) => {
        handleConfigData(config);
    });
}

if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const btn = settingsForm.querySelector('button[type="submit"]');
        if (btn) {
            btn.textContent = 'Saving...';
            btn.style.opacity = '0.7';
        }
        
        const updatedConfig = {
            gemini_api_key: document.getElementById('pref-gemini-key').value.trim(),
            assistant_name: document.getElementById('pref-assistant-name').value.trim(),
            elevenlabs_api_key: document.getElementById('pref-eleven-key').value.trim(),
            voice_id: document.getElementById('pref-voice-id').value.trim(),
            supabase_url: document.getElementById('pref-supabase-url').value.trim(),
            supabase_key: document.getElementById('pref-supabase-key').value.trim()
        };
        
        emitUpdateConfig(updatedConfig);
    });
}

function handleUpdateConfigSuccess(data) {
    console.log('[SETTINGS] Config save success');
    const btn = settingsForm?.querySelector('button[type="submit"]');
    if (btn) {
        btn.textContent = 'Save Preferences';
        btn.style.opacity = '1';
    }
    
    if (settingsStatus) {
        settingsStatus.textContent = data.message || 'Preferences saved successfully!';
        settingsStatus.style.display = 'block';
        settingsStatus.style.background = 'rgba(34, 197, 94, 0.1)';
        settingsStatus.style.color = 'var(--accent-green)';
        settingsStatus.style.borderColor = 'rgba(34, 197, 94, 0.2)';
        settingsStatus.style.borderStyle = 'solid';
        settingsStatus.style.borderWidth = '1px';
        
        setTimeout(() => {
            settingsStatus.style.display = 'none';
        }, 4000);
    }
}

function handleUpdateConfigError(data) {
    console.error('[SETTINGS] Config save error:', data.message);
    const btn = settingsForm?.querySelector('button[type="submit"]');
    if (btn) {
        btn.textContent = 'Save Preferences';
        btn.style.opacity = '1';
    }
    
    if (settingsStatus) {
        settingsStatus.textContent = data.message || 'Failed to save preferences.';
        settingsStatus.style.display = 'block';
        settingsStatus.style.background = 'rgba(239, 68, 68, 0.1)';
        settingsStatus.style.color = 'var(--accent-red)';
        settingsStatus.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        settingsStatus.style.borderStyle = 'solid';
        settingsStatus.style.borderWidth = '1px';
        
        setTimeout(() => {
            settingsStatus.style.display = 'none';
        }, 5000);
    }
}

if (socket) {
    socket.on('update_config_success', (data) => {
        handleUpdateConfigSuccess(data);
    });

    socket.on('update_config_error', (data) => {
        handleUpdateConfigError(data);
    });
}

// ═══════════════════════════════════════════
//  PARTICLE BACKGROUND (COSMIC SPACE THEME)
// ═══════════════════════════════════════════
const canvas = document.getElementById('bg-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let stars = [];
let nebulaParticles = [];
let shootingStars = [];

function initCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Twinkling & Drifting Stars
    stars = [];
    const starCount = Math.floor((canvas.width * canvas.height) / 8000);
    for (let i = 0; i < starCount; i++) {
        const size = Math.random() * 1.5 + 0.2;
        // Parallax speed: larger stars drift faster to create depth
        const speedMultiplier = size * 0.02;
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: size,
            twinkleSpeed: 0.005 + Math.random() * 0.015,
            phase: Math.random() * Math.PI,
            color: Math.random() > 0.6 ? (Math.random() > 0.5 ? '#888888' : '#bbbbbb') : '#ffffff',
            vx: -0.05 * speedMultiplier, // very slow horizontal drift
            vy: 0.02 * speedMultiplier   // very slow vertical drift
        });
    }
    
    // Nebula Dust Particles (larger, slow moving, very low opacity)
    nebulaParticles = [];
    const nebulaCount = Math.min(20, Math.floor(canvas.width / 100));
    for (let i = 0; i < nebulaCount; i++) {
        nebulaParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 150 + 50,
            vx: (Math.random() - 0.5) * 0.05,
            vy: (Math.random() - 0.5) * 0.05,
            color: Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.01)'
        });
    }
}

function spawnShootingStar() {
    if (shootingStars.length >= 2) return;
    shootingStars.push({
        x: Math.random() * canvas.width * 0.8,
        y: 0,
        length: Math.random() * 150 + 80,
        angle: Math.PI / 6 + Math.random() * (Math.PI / 12),
        speed: 15 + Math.random() * 10,
        opacity: 1,
        width: Math.random() * 2 + 0.5
    });
}

function animate() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw Nebula Particles
    nebulaParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < -p.size) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = canvas.height + p.size;
        if (p.y > canvas.height + p.size) p.y = -p.size;
        
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
    });
    
    // 2. Draw & Update Drifting/Twinkling Stars
    stars.forEach(s => {
        // Apply slow continuous drift
        s.x += s.vx;
        s.y += s.vy;
        
        // Wrap stars around boundaries seamlessly
        if (s.x < 0) s.x = canvas.width;
        if (s.x > canvas.width) s.x = 0;
        if (s.y < 0) s.y = canvas.height;
        if (s.y > canvas.height) s.y = 0;
        
        s.phase += s.twinkleSpeed;
        const opacity = 0.2 + (Math.sin(s.phase) + 1) * 0.4;
        
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = opacity;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
    
    // 3. Spontaneous Shooting Stars trigger
    if (Math.random() < 0.003) {
        spawnShootingStar();
    }
    
    // 4. Draw & Update Shooting Stars
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        const endX = ss.x + Math.cos(ss.angle) * ss.length;
        const endY = ss.y + Math.sin(ss.angle) * ss.length;
        
        const grad = ctx.createLinearGradient(ss.x, ss.y, endX, endY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity})`);
        grad.addColorStop(0.3, `rgba(255, 255, 255, ${ss.opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = ss.width;
        ctx.stroke();
        
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.opacity -= 0.02;
        
        if (ss.opacity <= 0 || ss.x > canvas.width || ss.y > canvas.height) {
            shootingStars.splice(i, 1);
        }
    }
    
    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    initCanvas();
});
initCanvas();
animate();

// Initialize voice voices
window.speechSynthesis.onvoiceschanged = () => {
    console.log('[TTS] Voices loaded');
};
