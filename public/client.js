const socket = io();

let currentUsername = '';
let typingTimeout = null;
let selectedAvatar = null;
let userAvatars = new Map(); // Store avatars for each user

// XP System Configuration
const XP_PER_MESSAGE = 10;
const XP_LEVELS = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 50 },
    { level: 3, xpRequired: 150 },
    { level: 4, xpRequired: 300 },
    { level: 5, xpRequired: 500 },
    { level: 6, xpRequired: 750 },
    { level: 7, xpRequired: 1050 },
    { level: 8, xpRequired: 1400 },
    { level: 9, xpRequired: 1800 },
    { level: 10, xpRequired: 2250 },
    { level: 11, xpRequired: 2750 },
    { level: 12, xpRequired: 3300 },
    { level: 13, xpRequired: 3900 },
    { level: 14, xpRequired: 4550 },
    { level: 15, xpRequired: 5250 }
];

// Achievements/Unlocks System
const ACHIEVEMENTS = [
    { id: 'first_message', name: 'First Steps', description: 'Send your first message', xpThreshold: 10, level: 1 },
    { id: 'level_5', name: 'Chatterbox', description: 'Reach Level 5', xpThreshold: 500, level: 5 },
    { id: 'level_10', name: 'Social Butterfly', description: 'Reach Level 10', xpThreshold: 2250, level: 10 },
    { id: 'level_15', name: 'Chat Master', description: 'Reach Level 15', xpThreshold: 5250, level: 15 },
    { id: 'messages_10', name: 'Getting Started', description: 'Send 10 messages', messageCount: 10 },
    { id: 'messages_50', name: 'Regular', description: 'Send 50 messages', messageCount: 50 },
    { id: 'messages_100', name: 'Dedicated', description: 'Send 100 messages', messageCount: 100 }
];

// User XP/Level Data
let userXP = 0;
let userLevel = 1;
let userAchievements = [];
let messageCount = 0;

// Sound Effects System
const messageSounds = [
    new Audio('sounds/760370__froey__message-sent.wav'),
    new Audio('sounds/760369__froey__message-receive.wav')
];
let currentSoundIndex = 0;

// Preload sounds
messageSounds.forEach(sound => {
    sound.volume = 0.5; // Set volume to 50%
    sound.preload = 'auto';
});

function playMessageSound() {
    const sound = messageSounds[currentSoundIndex];
    // Reset sound to beginning if it's already playing
    sound.currentTime = 0;
    sound.play().catch(err => {
        // Handle autoplay restrictions - user interaction required
        console.log('Sound play prevented:', err);
    });
    
    // Alternate to next sound
    currentSoundIndex = (currentSoundIndex + 1) % messageSounds.length;
}

// Avatar configuration
const AVATAR_FRAME_COUNT = 4; // Number of talking frames (horizontal sprite sheet)
const AVATAR_FRAME_WIDTH = 32; // Width of each frame in pixels
const AVATAR_FRAME_HEIGHT = 32; // Height of each frame in pixels
const AVATAR_IS_HORIZONTAL = true; // Spritesheet has frames in a row (horizontal)

// Default avatar options with different skin colors and hair styles
// Each avatar should be a horizontal sprite sheet with 4 frames (32×32px each)
const DEFAULT_AVATARS = [
    { name: 'Light Blonde', path: 'assets/avatar-light-blonde.png', skin: 'light', hair: 'blonde' },
    { name: 'Light Brunette', path: 'assets/avatar-light-brunette.png', skin: 'light', hair: 'brunette' },
    { name: 'Light Red', path: 'assets/avatar-light-red.png', skin: 'light', hair: 'red' },
    { name: 'Light Black', path: 'assets/avatar-light-black.png', skin: 'light', hair: 'black' },
    { name: 'Medium Blonde', path: 'assets/avatar-medium-blonde.png', skin: 'medium', hair: 'blonde' },
    { name: 'Medium Brunette', path: 'assets/avatar-medium-brunette.png', skin: 'medium', hair: 'brunette' },
    { name: 'Medium Red', path: 'assets/avatar-medium-red.png', skin: 'medium', hair: 'red' },
    { name: 'Medium Black', path: 'assets/avatar-medium-black.png', skin: 'medium', hair: 'black' },
    { name: 'Dark Blonde', path: 'assets/avatar-dark-blonde.png', skin: 'dark', hair: 'blonde' },
    { name: 'Dark Brunette', path: 'assets/avatar-dark-brunette.png', skin: 'dark', hair: 'brunette' },
    { name: 'Dark Red', path: 'assets/avatar-dark-red.png', skin: 'dark', hair: 'red' },
    { name: 'Dark Black', path: 'assets/avatar-dark-black.png', skin: 'dark', hair: 'black' },
    // Fallback to existing talking head if custom avatars don't exist
    { name: 'Default', path: 'assets/talking_head-spritesheet.png', skin: 'default', hair: 'default' }
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

// XP System Functions
function calculateLevel(xp) {
    for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
        if (xp >= XP_LEVELS[i].xpRequired) {
            return XP_LEVELS[i].level;
        }
    }
    return 1;
}

function getXPForNextLevel(currentLevel) {
    const nextLevel = currentLevel + 1;
    const nextLevelData = XP_LEVELS.find(l => l.level === nextLevel);
    if (nextLevelData) {
        return nextLevelData.xpRequired;
    }
    return XP_LEVELS[XP_LEVELS.length - 1].xpRequired;
}

function getXPProgress(currentXP, currentLevel) {
    const xpForCurrentLevel = XP_LEVELS.find(l => l.level === currentLevel)?.xpRequired || 0;
    const xpForNextLevel = getXPForNextLevel(currentLevel);
    const xpInCurrentLevel = currentXP - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
    return {
        current: xpInCurrentLevel,
        needed: xpNeededForNext,
        percentage: Math.min(100, (xpInCurrentLevel / xpNeededForNext) * 100)
    };
}

function checkAchievements(newXP, newLevel, newMessageCount) {
    const newAchievements = [];
    
    ACHIEVEMENTS.forEach(achievement => {
        // Check if already unlocked
        if (userAchievements.includes(achievement.id)) {
            return;
        }
        
        // Check level-based achievements
        if (achievement.level && newLevel >= achievement.level) {
            newAchievements.push(achievement);
            userAchievements.push(achievement.id);
        }
        // Check XP-based achievements
        else if (achievement.xpThreshold && newXP >= achievement.xpThreshold) {
            newAchievements.push(achievement);
            userAchievements.push(achievement.id);
        }
        // Check message count achievements
        else if (achievement.messageCount && newMessageCount >= achievement.messageCount) {
            newAchievements.push(achievement);
            userAchievements.push(achievement.id);
        }
    });
    
    return newAchievements;
}

function showXPNotification(xpEarned, newXP, newLevel, leveledUp = false) {
    const notification = document.createElement('div');
    notification.className = 'xp-notification';
    notification.innerHTML = `
        <div class="xp-notification-content">
            <span class="xp-gain">+${xpEarned} XP</span>
            ${leveledUp ? `<div class="level-up">LEVEL UP! Level ${newLevel}</div>` : ''}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function showAchievementUnlock(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-notification-content">
            <div class="achievement-icon">🏆</div>
            <div class="achievement-text">
                <div class="achievement-title">ACHIEVEMENT UNLOCKED!</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.description}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

function loadUserData() {
    const savedXP = localStorage.getItem('userXP');
    const savedLevel = localStorage.getItem('userLevel');
    const savedAchievements = localStorage.getItem('userAchievements');
    const savedMessageCount = localStorage.getItem('messageCount');
    
    if (savedXP) userXP = parseInt(savedXP, 10);
    if (savedLevel) userLevel = parseInt(savedLevel, 10);
    if (savedAchievements) userAchievements = JSON.parse(savedAchievements);
    if (savedMessageCount) messageCount = parseInt(savedMessageCount, 10);
    
    // Recalculate level from XP to ensure consistency
    userLevel = calculateLevel(userXP);
    updateXPDisplay();
}

function saveUserData() {
    localStorage.setItem('userXP', userXP.toString());
    localStorage.setItem('userLevel', userLevel.toString());
    localStorage.setItem('userAchievements', JSON.stringify(userAchievements));
    localStorage.setItem('messageCount', messageCount.toString());
}

function updateXPDisplay() {
    const xpDisplay = document.getElementById('xpDisplay');
    if (xpDisplay) {
        const progress = getXPProgress(userXP, userLevel);
        xpDisplay.innerHTML = `
            <div class="xp-info">
                <span class="level-badge">Lv. ${userLevel}</span>
                <span class="xp-text">${userXP} XP</span>
            </div>
            <div class="xp-bar-container">
                <div class="xp-bar" style="width: ${progress.percentage}%"></div>
            </div>
            <div class="xp-next">${progress.current}/${progress.needed} to next level</div>
        `;
    }
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
    // Create default avatar options with error handling for missing images
    DEFAULT_AVATARS.forEach((avatar, index) => {
        const avatarOption = document.createElement('div');
        avatarOption.className = 'avatar-option';
        avatarOption.dataset.avatarPath = avatar.path;
        avatarOption.dataset.skin = avatar.skin || 'default';
        avatarOption.dataset.hair = avatar.hair || 'default';
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'avatar-preview';
        previewDiv.style.backgroundImage = `url(${avatar.path})`;
        previewDiv.style.backgroundSize = getAvatarBackgroundSize();
        previewDiv.style.backgroundPosition = '0 0';
        
        // Check if image exists, show placeholder if not
        let imageLoaded = false;
        const img = new Image();
        img.onload = () => {
            imageLoaded = true;
            previewDiv.style.backgroundImage = `url(${avatar.path})`;
            avatarOption.dataset.loaded = 'true';
        };
        img.onerror = () => {
            imageLoaded = false;
            // If image doesn't exist, show a placeholder
            previewDiv.style.backgroundColor = '#333';
            previewDiv.style.backgroundImage = 'none';
            previewDiv.textContent = '?';
            previewDiv.style.color = '#00ff00';
            previewDiv.style.fontSize = '20px';
            previewDiv.style.textAlign = 'center';
            previewDiv.style.lineHeight = '32px';
            avatarOption.style.opacity = '0.6';
            avatarOption.style.cursor = 'not-allowed';
            avatarOption.title = 'Avatar image not found: ' + avatar.path;
            avatarOption.dataset.loaded = 'false';
        };
        img.src = avatar.path;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = avatar.name;
        
        avatarOption.appendChild(previewDiv);
        avatarOption.appendChild(nameSpan);
        
        avatarOption.addEventListener('click', () => {
            // Only allow selection if image loaded successfully
            if (avatarOption.dataset.loaded === 'true' || imageLoaded) {
                // Remove selected class from all options
                document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
                // Add selected class to clicked option
                avatarOption.classList.add('selected');
                selectedAvatar = avatar.path;
            }
        });
        
        avatarOptions.appendChild(avatarOption);
    });
    
    // Select first available avatar by default (wait a bit for images to load)
    setTimeout(() => {
        const firstValidOption = Array.from(avatarOptions.querySelectorAll('.avatar-option')).find(opt => {
            return opt.dataset.loaded === 'true';
        });
        if (firstValidOption) {
            firstValidOption.click();
        } else if (avatarOptions.firstChild) {
            // Fallback to first option (might be placeholder, but user can change)
            avatarOptions.firstChild.click();
        }
    }, 100);
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
        // Award XP for sending a message
        const oldLevel = userLevel;
        userXP += XP_PER_MESSAGE;
        messageCount++;
        
        // Calculate new level
        const newLevel = calculateLevel(userXP);
        const leveledUp = newLevel > oldLevel;
        userLevel = newLevel;
        
        // Check for achievements
        const newAchievements = checkAchievements(userXP, userLevel, messageCount);
        
        // Show XP notification
        showXPNotification(XP_PER_MESSAGE, userXP, userLevel, leveledUp);
        
        // Show achievement unlocks
        newAchievements.forEach(achievement => {
            setTimeout(() => {
                showAchievementUnlock(achievement);
            }, 500);
        });
        
        // Save user data
        saveUserData();
        updateXPDisplay();
        
        // Play message sound
        playMessageSound();
        
        // Send message
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
    avatarDiv.className = 'message-avatar';
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
    
    // Animate avatar talking for 600ms when message appears
    avatarDiv.classList.add('talking');
    setTimeout(() => {
        avatarDiv.classList.remove('talking');
    }, 600);
    
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
    loadUserData(); // Load XP/level data
    
    // Initialize sounds - try to play and pause to unlock audio context
    // This helps with browser autoplay restrictions
    messageSounds.forEach(sound => {
        sound.load();
    });
    
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
