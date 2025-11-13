const socket = io();

let currentUsername = '';
let typingTimeout = null;
let selectedAvatar = null;
let userAvatars = new Map(); // Store avatars for each user

// Avatar configuration
const AVATAR_FRAME_COUNT = 4; // Number of talking frames (horizontal sprite sheet)
const AVATAR_FRAME_WIDTH = 32; // Width of each frame in pixels
const AVATAR_FRAME_HEIGHT = 32; // Height of each frame in pixels
const AVATAR_IS_HORIZONTAL = true; // Spritesheet has frames in a row (horizontal)

// Default avatar options (you can add more default avatars here)
const DEFAULT_AVATARS = [
    { name: 'Talking Head', path: 'assets/talking_head-spritesheet.png' },
    // Custom pixel avatar with 4 frames in a horizontal row
];

// Helper function to get background-size for sprite sheets
function getAvatarBackgroundSize() {
    if (AVATAR_IS_HORIZONTAL) {
        return `${AVATAR_FRAME_COUNT * AVATAR_FRAME_WIDTH}px ${AVATAR_FRAME_HEIGHT}px`;
    } else {
        return `${AVATAR_FRAME_WIDTH}px ${AVATAR_FRAME_COUNT * AVATAR_FRAME_HEIGHT}px`;
    }
}

// Get avatar image path for a user
function getAvatarPath(username) {
    if (userAvatars.has(username)) {
        return userAvatars.get(username);
    }
    // Fallback to default
    return DEFAULT_AVATARS[0].path;
}

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
const avatarOptions = document.getElementById('avatarOptions');
const avatarFileInput = document.getElementById('avatarFileInput');
const uploadAvatarButton = document.getElementById('uploadAvatarButton');

// Initialize avatar selection
function initializeAvatarSelection() {
    // Create default avatar options
    DEFAULT_AVATARS.forEach((avatar, index) => {
        const avatarOption = document.createElement('div');
        avatarOption.className = 'avatar-option';
        avatarOption.dataset.avatarPath = avatar.path;
        avatarOption.innerHTML = `
            <div class="avatar-preview" style="background-image: url(${avatar.path}); background-size: ${getAvatarBackgroundSize()}; background-position: 0 0;"></div>
            <span>${avatar.name}</span>
        `;
        avatarOption.addEventListener('click', () => {
            // Remove selected class from all options
            document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            // Add selected class to clicked option
            avatarOption.classList.add('selected');
            selectedAvatar = avatar.path;
        });
        avatarOptions.appendChild(avatarOption);
    });
    
    // Select first avatar by default
    if (avatarOptions.firstChild) {
        avatarOptions.firstChild.click();
    }
}

// Handle custom avatar upload
uploadAvatarButton.addEventListener('click', () => {
    avatarFileInput.click();
});

avatarFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            // Remove selected class from all options
            document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            selectedAvatar = dataUrl;
            
            // Create a preview for the uploaded avatar
            const customPreview = document.createElement('div');
            customPreview.className = 'avatar-option selected custom-avatar';
            customPreview.innerHTML = `
                <div class="avatar-preview" style="background-image: url(${dataUrl}); background-size: ${getAvatarBackgroundSize()}; background-position: 0 0;"></div>
                <span>Custom</span>
            `;
            // Remove any existing custom avatar
            const existingCustom = avatarOptions.querySelector('.custom-avatar');
            if (existingCustom) {
                existingCustom.remove();
            }
            avatarOptions.appendChild(customPreview);
        };
        reader.readAsDataURL(file);
    }
});

// Handle username submission
joinButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username && selectedAvatar) {
        currentUsername = username;
        // Store avatar for current user
        userAvatars.set(username, selectedAvatar);
        // Store in localStorage
        localStorage.setItem('chatUsername', username);
        localStorage.setItem('chatAvatar', selectedAvatar);
        
        socket.emit('join', { 
            username: username,
            avatar: selectedAvatar 
        });
        usernameModal.style.display = 'none';
        messageInput.focus();
    } else if (username) {
        alert('Please select an avatar');
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
    // Store avatar for the user who joined
    if (data.avatar) {
        userAvatars.set(data.username, data.avatar);
    }
    addSystemMessage(data.message, 'join');
});

socket.on('userLeft', (data) => {
    addSystemMessage(data.message, 'leave');
});

socket.on('userList', (users) => {
    // Store avatars for all users
    if (Array.isArray(users)) {
        users.forEach(user => {
            if (typeof user === 'object' && user.avatar) {
                userAvatars.set(user.username, user.avatar);
            } else if (typeof user === 'string') {
                // Legacy format, use default
                userAvatars.set(user, DEFAULT_AVATARS[0].path);
            }
        });
    }
    const userNames = Array.isArray(users) ? 
        users.map(u => typeof u === 'object' ? u.username : u) : 
        users;
    updateUserList(userNames);
    userCountSpan.textContent = userNames.length;
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
    
    // Get avatar path (use avatar from message data if available, otherwise lookup)
    const avatarPath = data.avatar || getAvatarPath(data.username);
    
    // Store avatar for this user
    if (data.avatar) {
        userAvatars.set(data.username, data.avatar);
    }
    
    // Create avatar element (using div for sprite sheet animation)
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar talking';
    avatarDiv.style.backgroundImage = `url(${avatarPath})`;
    // Calculate background-size based on sprite sheet orientation
    if (AVATAR_IS_HORIZONTAL) {
        // Horizontal: width = frames * frame_width, height = frame_height
        avatarDiv.style.backgroundSize = `${AVATAR_FRAME_COUNT * AVATAR_FRAME_WIDTH}px ${AVATAR_FRAME_HEIGHT}px`;
    } else {
        // Vertical: width = frame_width, height = frames * frame_height
        avatarDiv.style.backgroundSize = `${AVATAR_FRAME_WIDTH}px ${AVATAR_FRAME_COUNT * AVATAR_FRAME_HEIGHT}px`;
    }
    avatarDiv.style.backgroundPosition = '0 0';
    avatarDiv.style.backgroundRepeat = 'no-repeat';
    avatarDiv.setAttribute('aria-label', `${data.username}'s avatar`);
    
    // Preload and verify image
    const img = new Image();
    img.onload = () => {
        // Image loaded successfully - ensure it's displayed
        avatarDiv.style.backgroundImage = `url(${avatarPath})`;
    };
    img.onerror = () => {
        console.warn(`Avatar image failed to load: ${avatarPath}`);
        console.warn('Make sure the image file exists in the public folder');
        // Show a placeholder or error indicator
        avatarDiv.style.backgroundImage = 'none';
        avatarDiv.style.backgroundColor = '#333';
        avatarDiv.textContent = '?';
        avatarDiv.style.color = '#00ff00';
        avatarDiv.style.fontSize = '20px';
        avatarDiv.style.textAlign = 'center';
        avatarDiv.style.lineHeight = '32px';
    };
    img.src = avatarPath;
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    contentWrapper.innerHTML = `
        <div class="message-header">
            <span class="username" style="color: ${userColor}">${escapeHtml(data.username)}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <div class="message-content">${escapeHtml(data.message)}</div>
    `;
    
    // Add avatar and content to message
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentWrapper);
    
    // Animate avatar talking for 1.5 seconds when message appears
    setTimeout(() => {
        avatarDiv.classList.remove('talking');
    }, 1500);
    
    messagesDiv.appendChild(messageDiv);
    
    // Get container dimensions (accounting for padding)
    const containerWidth = messagesDiv.offsetWidth;
    const containerPadding = 20; // padding from CSS
    const availableWidth = containerWidth - (containerPadding * 2);
    
    // Wait for message to render to get actual dimensions
    // Force a reflow to get accurate measurements
    void messageDiv.offsetHeight;
    const messageHeight = messageDiv.offsetHeight || 80;
    // Account for avatar width (32px) + gap (10px) when calculating message width
    let messageWidth = messageDiv.offsetWidth || 280;
    const avatarAndGapWidth = 32 + 10; // avatar width + gap
    
    // Enforce max-width constraint - ensure message doesn't exceed 65% of available width
    // Account for avatar when setting max width
    const maxAllowedWidth = (availableWidth * 0.65) - avatarAndGapWidth;
    if (messageWidth > maxAllowedWidth + avatarAndGapWidth) {
        messageWidth = maxAllowedWidth + avatarAndGapWidth;
        messageDiv.style.maxWidth = `${maxAllowedWidth + avatarAndGapWidth}px`;
    }
    
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
        // Ensure message fits within right side of container
        const minX = containerWidth * 0.55; // Start at 55% of container
        const maxX = containerWidth - messageWidth - containerPadding;
        x = minX + Math.random() * (maxX - minX);
        x = Math.max(minX, Math.min(x, maxX));
        
        // Vertical position with randomness
        y = startY + (Math.random() * 25 - 12.5); // -12.5px to +12.5px variation
    } else {
        // Other messages: position on the left side with variation
        // Ensure message fits within left side of container
        const minX = containerPadding;
        const maxX = Math.min(containerWidth * 0.5 - messageWidth, containerWidth - messageWidth - containerPadding);
        x = minX + Math.random() * Math.max(0, maxX - minX);
        x = Math.max(minX, Math.min(x, maxX));
        
        // Vertical position with randomness
        y = startY + (Math.random() * 25 - 12.5); // -12.5px to +12.5px variation
    }
    
    // Ensure y is within reasonable bounds
    y = Math.max(30, y);
    
    // Final safety check: ensure message doesn't overflow horizontally
    // messageWidth already includes avatar, so use it as-is
    const absoluteMaxX = containerWidth - messageWidth - containerPadding;
    const absoluteMinX = containerPadding;
    x = Math.max(absoluteMinX, Math.min(x, absoluteMaxX));
    
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
        
        // Create avatar for user list
        const userAvatar = document.createElement('div');
        userAvatar.className = 'user-avatar';
        const userAvatarPath = getAvatarPath(user);
        userAvatar.style.backgroundImage = `url(${userAvatarPath})`;
        // User list avatars are 24px, so scale the background-size accordingly
        if (AVATAR_IS_HORIZONTAL) {
            userAvatar.style.backgroundSize = `${AVATAR_FRAME_COUNT * 24}px 24px`; // 4 frames * 24px width
        } else {
            userAvatar.style.backgroundSize = `24px ${AVATAR_FRAME_COUNT * 24}px`; // 4 frames * 24px height
        }
        userAvatar.style.backgroundPosition = '0 0';
        userAvatar.style.backgroundRepeat = 'no-repeat';
        userAvatar.setAttribute('aria-label', `${user}'s avatar`);
        
        userDiv.innerHTML = `
            <span class="user-indicator">●</span>
            <span>${escapeHtml(user)}</span>
        `;
        // Insert avatar at the beginning
        userDiv.insertBefore(userAvatar, userDiv.firstChild);
        userListDiv.appendChild(userDiv);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeAvatarSelection();
    
    // Load saved username and avatar from localStorage
    const savedUsername = localStorage.getItem('chatUsername');
    const savedAvatar = localStorage.getItem('chatAvatar');
    if (savedUsername) {
        usernameInput.value = savedUsername;
    }
    if (savedAvatar) {
        selectedAvatar = savedAvatar;
        // Try to find and select the matching avatar option
        const matchingOption = Array.from(avatarOptions.querySelectorAll('.avatar-option')).find(opt => 
            opt.dataset.avatarPath === savedAvatar
        );
        if (matchingOption) {
            matchingOption.click();
        } else {
            // It's a custom avatar, create preview
            const customPreview = document.createElement('div');
            customPreview.className = 'avatar-option selected custom-avatar';
            customPreview.innerHTML = `
                <div class="avatar-preview" style="background-image: url(${savedAvatar}); background-size: ${getAvatarBackgroundSize()}; background-position: 0 0;"></div>
                <span>Custom</span>
            `;
            const existingCustom = avatarOptions.querySelector('.custom-avatar');
            if (existingCustom) {
                existingCustom.remove();
            }
            avatarOptions.appendChild(customPreview);
        }
    }
});
