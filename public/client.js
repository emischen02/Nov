const socket = io();

let currentUsername = '';
let typingTimeout = null;

// Get DOM elements
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const joinButton = document.getElementById('joinButton');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messagesDiv = document.getElementById('messages');
const userListDiv = document.getElementById('userList');
const userCountSpan = document.getElementById('userCount');
const typingIndicator = document.getElementById('typingIndicator');

// Handle username submission
joinButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        currentUsername = username;
        socket.emit('join', username);
        usernameModal.style.display = 'none';
        messageInput.focus();
    }
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinButton.click();
    }
});

// Handle message sending
sendButton.addEventListener('click', () => {
    sendMessage();
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('message', { message });
        messageInput.value = '';
        socket.emit('typing', { isTyping: false });
    }
}

// Handle typing indicator
messageInput.addEventListener('input', () => {
    socket.emit('typing', { isTyping: true });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { isTyping: false });
    }, 1000);
});

// Socket event listeners
socket.on('message', (data) => {
    addMessage(data);
});

socket.on('userJoined', (data) => {
    addSystemMessage(data.message, 'join');
});

socket.on('userLeft', (data) => {
    addSystemMessage(data.message, 'leave');
});

socket.on('userList', (users) => {
    updateUserList(users);
    userCountSpan.textContent = users.length;
});

socket.on('typing', (data) => {
    if (data.isTyping && data.username !== currentUsername) {
        typingIndicator.textContent = `${data.username} is typing...`;
        typingIndicator.style.display = 'block';
    } else {
        typingIndicator.style.display = 'none';
    }
});

function addMessage(data) {
    const messageDiv = document.createElement('div');
    const isOwnMessage = data.id === socket.id;
    
    messageDiv.className = `message ${isOwnMessage ? 'own-message' : ''}`;
    
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="username">${escapeHtml(data.username)}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <div class="message-content">${escapeHtml(data.message)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `system-message ${type}`;
    messageDiv.textContent = message;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateUserList(users) {
    userListDiv.innerHTML = '';
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.innerHTML = `
            <span class="user-indicator">●</span>
            <span>${escapeHtml(user)}</span>
        `;
        userListDiv.appendChild(userDiv);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
