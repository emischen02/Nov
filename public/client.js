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

// Track message positions for collision detection
let messagePositions = [];
const MESSAGE_SPACING = 20; // Minimum spacing between bubbles

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
    
    // Wait for message to render to get actual dimensions
    const messageHeight = messageDiv.offsetHeight || 80;
    const messageWidth = messageDiv.offsetWidth || 280;
    
    // Get container dimensions (accounting for padding)
    const containerWidth = messagesDiv.offsetWidth;
    const containerPadding = 20; // padding from CSS
    const availableWidth = containerWidth - (containerPadding * 2);
    
    // Generate random rotation for organic feel
    const rotation = (Math.random() - 0.5) * 12; // -6deg to +6deg
    
    let x, y;
    
    // Calculate the highest Y position of existing messages
    const existingMessages = Array.from(messagesDiv.querySelectorAll('.message'));
    let highestY = 0;
    if (existingMessages.length > 0) {
        existingMessages.forEach(msg => {
            const msgY = parseInt(msg.style.top) || 0;
            const msgHeight = msg.offsetHeight || 80;
            highestY = Math.max(highestY, msgY + msgHeight);
        });
    }
    
    // Start new messages from the bottom of visible area or after the highest message
    const containerVisibleHeight = messagesDiv.clientHeight;
    const currentScrollTop = messagesDiv.scrollTop;
    const bottomOfVisibleArea = currentScrollTop + containerVisibleHeight;
    
    const startY = existingMessages.length > 0 ? 
                   highestY + MESSAGE_SPACING : 
                   Math.max(containerVisibleHeight - messageHeight - 50, 50);
    
    if (isOwnMessage) {
        // Own messages: position on the right side with variation
        const rightAreaStart = availableWidth * 0.52; // Start slightly right of center
        const rightAreaWidth = availableWidth * 0.43; // Use 43% of width
        x = rightAreaStart + Math.random() * rightAreaWidth;
        // Ensure message doesn't overflow - account for padding and message width
        x = Math.max(rightAreaStart, Math.min(x, availableWidth - messageWidth + containerPadding));
        
        // Vertical position with randomness
        y = startY + (Math.random() * 25 - 12.5); // -12.5px to +12.5px variation
    } else {
        // Other messages: position on the left side with variation
        const leftAreaWidth = availableWidth * 0.43; // Use 43% of width
        x = containerPadding + Math.random() * leftAreaWidth;
        // Ensure message doesn't overflow - keep within left half
        x = Math.max(containerPadding, Math.min(x, availableWidth * 0.5 - messageWidth + containerPadding));
        
        // Vertical position with randomness
        y = startY + (Math.random() * 25 - 12.5); // -12.5px to +12.5px variation
    }
    
    // Ensure y is within reasonable bounds
    y = Math.max(30, y);
    
    // Final check: ensure message doesn't overflow horizontally
    const maxX = containerWidth - messageWidth - containerPadding;
    x = Math.max(containerPadding, Math.min(x, maxX));
    
    // Set position
    messageDiv.style.left = `${x}px`;
    messageDiv.style.top = `${y}px`;
    messageDiv.style.transform = `rotate(${rotation}deg)`;
    messageDiv.dataset.rotation = rotation;
    
    // Store position for collision detection (use actual rendered width)
    messagePositions.push({
        x: x,
        y: y,
        width: messageDiv.offsetWidth,
        height: messageHeight
    });
    
    // Clean up old positions (keep last 100)
    if (messagePositions.length > 100) {
        messagePositions.shift();
    }
    
    // Add animation
    setTimeout(() => {
        const storedRotation = messageDiv.dataset.rotation || 0;
        messageDiv.style.transform = `rotate(${storedRotation}deg) scale(1)`;
        messageDiv.style.opacity = '1';
    }, 10);
    
    // Update container height to accommodate all messages
    const finalY = y + messageHeight + 50;
    const currentScrollHeight = messagesDiv.scrollHeight;
    if (finalY > currentScrollHeight) {
        messagesDiv.style.minHeight = `${finalY}px`;
    }
    
    // Scroll to show the new message
    setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 100);
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
    
    // Position system messages centered horizontally
    // They'll be positioned relative to the flow of messages
    const existingMessages = Array.from(messagesDiv.querySelectorAll('.message'));
    let highestY = 0;
    if (existingMessages.length > 0) {
        existingMessages.forEach(msg => {
            const msgY = parseInt(msg.style.top) || 0;
            const msgHeight = msg.offsetHeight || 80;
            highestY = Math.max(highestY, msgY + msgHeight);
        });
    }
    
    const systemY = Math.max(30, highestY + 20);
    messageDiv.style.top = `${systemY}px`;
    
    // Update container height
    const finalY = systemY + messageDiv.offsetHeight + 20;
    const currentScrollHeight = messagesDiv.scrollHeight;
    if (finalY > currentScrollHeight) {
        messagesDiv.style.minHeight = `${finalY}px`;
    }
    
    setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 100);
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
