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
    
    messageDiv.className = `message ${isOwnMessage ? 'own-message' : 'other-message'}`;
    
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    
    // Generate color based on username for consistency
    const userColor = getColorForUser(data.username);
    
    // Set border color for other messages
    if (!isOwnMessage) {
        messageDiv.style.borderLeftColor = userColor;
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="username" style="color: ${userColor}">${escapeHtml(data.username)}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <div class="message-content">${escapeHtml(data.message)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    
    // Non-linear positioning
    if (!isOwnMessage) {
        // Get messages container width
        const containerWidth = messagesDiv.offsetWidth;
        
        // Calculate available width (accounting for message max-width of 65%)
        const maxMessageWidth = containerWidth * 0.65;
        const availableSpace = containerWidth - maxMessageWidth;
        
        // Random horizontal offset - more varied for non-linear effect
        // Use a wider range, but keep it within bounds
        const randomOffset = Math.random() * Math.min(availableSpace * 0.6, 150);
        messageDiv.style.marginLeft = `${randomOffset}px`;
        
        // Add vertical stagger for more organic feel
        const verticalStagger = (Math.random() - 0.5) * 20; // -10px to +10px
        messageDiv.style.marginTop = `${verticalStagger}px`;
        
        // More pronounced rotation for non-linear feel
        const rotation = (Math.random() - 0.5) * 8; // -4deg to +4deg
        messageDiv.style.transform = `rotate(${rotation}deg)`;
        
        // Store rotation for animation
        messageDiv.dataset.rotation = rotation;
    } else {
        // Own messages can also have slight variation
        const slightRotation = (Math.random() - 0.5) * 2; // -1deg to +1deg
        messageDiv.style.transform = `rotate(${slightRotation}deg)`;
        messageDiv.dataset.rotation = slightRotation;
    }
    
    // Add animation
    setTimeout(() => {
        const rotation = messageDiv.dataset.rotation || 0;
        messageDiv.style.transform = `rotate(${rotation}deg) scale(1)`;
        messageDiv.style.opacity = '1';
    }, 10);
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Generate consistent color for each user
const userColors = new Map();
function getColorForUser(username) {
    if (!userColors.has(username)) {
        const hue = (username.charCodeAt(0) * 137.508) % 360;
        userColors.set(username, `hsl(${hue}, 65%, 50%)`);
    }
    return userColors.get(username);
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
