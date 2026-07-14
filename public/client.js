const socket = io();
let currentUser = null;
let isAdmin = false;

// DOM元素
const loginModal = document.getElementById('loginModal');
const chatContainer = document.getElementById('chatContainer');
const usernameInput = document.getElementById('usernameInput');
const messageInput = document.getElementById('messageInput');
const chatMessages = document.getElementById('chatMessages');
const onlineCount = document.getElementById('onlineCount');
const adminPanel = document.getElementById('adminPanel');
const adminBtn = document.getElementById('adminBtn');

// 检查是否已登录（从localStorage恢复）
window.onload = function() {
    const savedUserId = localStorage.getItem('chat_userId');
    const savedUsername = localStorage.getItem('chat_username');
    
    if (savedUserId && savedUsername) {
        currentUser = {
            userId: savedUserId,
            username: savedUsername
        };
        showChatInterface();
        joinChatRoom();
    }
};

// 加入聊天
function joinChat() {
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('请输入昵称！');
        usernameInput.focus();
        return;
    }
    
    if (username.length > 20) {
        alert('昵称不能超过20个字符！');
        return;
    }
    
    // 生成或恢复用户ID
    let userId = localStorage.getItem('chat_userId');
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('chat_userId', userId);
    }
    
    currentUser = { userId, username };
    localStorage.setItem('chat_username', username);
    
    showChatInterface();
    joinChatRoom();
}

// 生成用户ID
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 显示聊天界面
function showChatInterface() {
    loginModal.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    
    // 加载历史消息
    loadMessageHistory();
    
    // 聚焦输入框
    setTimeout(() => messageInput.focus(), 100);
}

// 加入聊天室
function joinChatRoom() {
    socket.emit('join', currentUser);
    
    // 添加系统消息
    addSystemMessage(`${currentUser.username} 加入了聊天室`);
}

// 加载历史消息
async function loadMessageHistory() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            addSystemMessage('欢迎来到摸鱼聊天室！开始你的表演吧~ 😏');
        } else {
            messages.forEach(msg => {
                addMessageToUI(msg, false);
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error('加载历史消息失败:', error);
        addSystemMessage('加载历史消息失败，请刷新页面重试');
    }
}

// 发送消息
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    if (!currentUser) {
        alert('请先加入聊天室！');
        return;
    }
    
    socket.emit('send_message', {
        userId: currentUser.userId,
        username: currentUser.username,
        message: message
    });
    
    messageInput.value = '';
    messageInput.focus();
}

// 添加消息到UI
function addMessageToUI(data, animate = true) {
    const isOwnMessage = currentUser && data.userId === currentUser.userId;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
    
    const time = new Date(data.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-header">
                <span class="username">${escapeHtml(data.username)}</span>
                <span class="timestamp">${time}</span>
            </div>
            <div class="message-bubble">${formatMessage(data.message)}</div>
        </div>
    `;
    
    if (animate) {
        messageDiv.style.opacity = '0';
        chatMessages.appendChild(messageDiv);
        setTimeout(() => {
            messageDiv.style.transition = 'opacity 0.3s';
            messageDiv.style.opacity = '1';
        }, 10);
    } else {
        chatMessages.appendChild(messageDiv);
    }
    
    scrollToBottom();
}

// 添加系统消息
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// 滚动到底部
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 格式化消息（支持简单表情）
function formatMessage(text) {
    const escaped = escapeHtml(text);
    // 简单的表情转换
    return escaped
        .replace(/:\)/g, '😊')
        .replace(/:\(/g, '😢')
        .replace(/:D/g, '😃')
        .replace(/:P/g, '😛')
        .replace(/;\)/g, '😉')
        .replace(/<3/g, '❤️')
        .replace(/:thumbsup:/g, '👍')
        .replace(/:coffee:/g, '☕')
        .replace(/:fish:/g, '🐟')
        .replace(/\n/g, '<br>');
}

// HTML转义防止XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示管理员面板
function showAdminPanel() {
    adminPanel.style.display = 'block';
    adminBtn.style.display = 'none';
}

// 清空聊天记录
async function clearChat() {
    const password = document.getElementById('adminPassword').value;
    const messageEl = document.getElementById('adminMessage');
    
    if (!password) {
        showAdminMessage('请输入管理员密码！', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminMessage('聊天记录已清空！', 'success');
            chatMessages.innerHTML = '';
            addSystemMessage('聊天记录已被管理员清空');
            adminPanel.style.display = 'none';
            adminBtn.style.display = 'inline-block';
            document.getElementById('adminPassword').value = '';
        } else {
            showAdminMessage(result.error || '操作失败', 'error');
        }
    } catch (error) {
        showAdminMessage('网络错误，请重试', 'error');
    }
}

// 显示管理员消息
function showAdminMessage(text, type) {
    const messageEl = document.getElementById('adminMessage');
    messageEl.textContent = text;
    messageEl.className = `admin-message ${type}`;
    
    setTimeout(() => {
        messageEl.textContent = '';
        messageEl.className = 'admin-message';
    }, 3000);
}

// 退出登录
function logout() {
    if (confirm('确定要退出聊天室吗？')) {
        localStorage.removeItem('chat_userId');
        localStorage.removeItem('chat_username');
        location.reload();
    }
}

// Socket事件监听
socket.on('connect', () => {
    console.log('已连接到服务器');
});

socket.on('new_message', (data) => {
    addMessageToUI(data);
});

socket.on('user_joined', (data) => {
    addSystemMessage(data.message);
});

socket.on('online_count', (count) => {
    onlineCount.innerHTML = `<i class="fas fa-user"></i> 在线: ${count}人`;
});

socket.on('clear_chat', () => {
    chatMessages.innerHTML = '';
    addSystemMessage('聊天记录已被管理员清空');
});

// 回车键发送消息
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 回车键加入聊天
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinChat();
    }
});

// 定期检查管理员权限（简化版：通过URL参数）
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('admin') === 'true') {
    // 显示管理员按钮
    window.onload = function() {
        const savedUserId = localStorage.getItem('chat_userId');
        const savedUsername = localStorage.getItem('chat_username');
        
        if (savedUserId && savedUsername) {
            currentUser = { userId: savedUserId, username: savedUsername };
            showChatInterface();
            joinChatRoom();
            adminBtn.classList.remove('hidden');
        }
    };
}