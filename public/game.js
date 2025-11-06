const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let currentPlayer = null;
let gameState = {
  players: [],
  food: { x: 0, y: 0 }
};

let direction = { x: 20, y: 0 };
let keys = {};

// Get username from chat or prompt
function getUsername() {
  const storedUsername = localStorage.getItem('chatUsername');
  if (storedUsername) {
    return storedUsername;
  }
  return null;
}

// Handle username input
const gameUsernameInput = document.getElementById('gameUsernameInput');
const joinGameButton = document.getElementById('joinGameButton');
const gameOverlay = document.getElementById('gameOverlay');

// Check if username exists from chat
const existingUsername = getUsername();
if (existingUsername) {
  gameUsernameInput.value = existingUsername;
}

joinGameButton.addEventListener('click', () => {
  const username = gameUsernameInput.value.trim();
  if (username) {
    localStorage.setItem('chatUsername', username);
    socket.username = username;
    socket.emit('join', username); // Join chat first to set username
    socket.emit('joinGame', { username });
    gameOverlay.style.display = 'none';
    startGame();
  }
});

gameUsernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinGameButton.click();
  }
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  
  if (currentPlayer) {
    if ((keys['ArrowUp'] || keys['w'] || keys['W']) && direction.y === 0) {
      direction = { x: 0, y: -20 };
      socket.emit('playerMove', { direction });
    } else if ((keys['ArrowDown'] || keys['s'] || keys['S']) && direction.y === 0) {
      direction = { x: 0, y: 20 };
      socket.emit('playerMove', { direction });
    } else if ((keys['ArrowLeft'] || keys['a'] || keys['A']) && direction.x === 0) {
      direction = { x: -20, y: 0 };
      socket.emit('playerMove', { direction });
    } else if ((keys['ArrowRight'] || keys['d'] || keys['D']) && direction.x === 0) {
      direction = { x: 20, y: 0 };
      socket.emit('playerMove', { direction });
    }
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Socket event handlers
socket.on('gameState', (data) => {
  gameState = data;
  currentPlayer = gameState.players.find(p => p.id === socket.id);
  if (currentPlayer) {
    direction = currentPlayer.direction;
  }
  updateLeaderboard();
  updatePlayerList();
});

socket.on('gameUpdate', (data) => {
  gameState = data;
  currentPlayer = gameState.players.find(p => p.id === socket.id);
  if (currentPlayer) {
    direction = currentPlayer.direction;
  }
  draw();
  updateLeaderboard();
  updatePlayerList();
});

socket.on('playerJoined', (data) => {
  gameState.players = data.players;
  updateLeaderboard();
  updatePlayerList();
});

socket.on('playerLeft', (data) => {
  if (data.players) {
    gameState.players = data.players;
  } else {
    gameState.players = gameState.players.filter(p => p.id !== data.playerId);
  }
  updateLeaderboard();
  updatePlayerList();
});

function startGame() {
  draw();
}

function draw() {
  // Clear canvas
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid
  ctx.strokeStyle = '#16213e';
  ctx.lineWidth = 1;
  for (let i = 0; i <= canvas.width; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i <= canvas.height; i += 20) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
  
  // Draw food
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.arc(gameState.food.x + 10, gameState.food.y + 10, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw all players
  gameState.players.forEach(player => {
    const isCurrentPlayer = player.id === socket.id;
    
    // Draw snake
    player.snake.forEach((segment, index) => {
      if (index === 0) {
        // Head
        ctx.fillStyle = isCurrentPlayer ? '#4ecdc4' : player.color;
        ctx.fillRect(segment.x, segment.y, 18, 18);
        
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(segment.x + 4, segment.y + 4, 3, 3);
        ctx.fillRect(segment.x + 11, segment.y + 4, 3, 3);
      } else {
        // Body
        ctx.fillStyle = isCurrentPlayer ? '#45b7b8' : player.color;
        ctx.fillRect(segment.x + 1, segment.y + 1, 18, 18);
      }
    });
    
    // Draw player name above snake
    if (player.snake.length > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.username, player.snake[0].x + 10, player.snake[0].y - 5);
    }
  });
}

function updateLeaderboard() {
  const leaderboard = document.getElementById('leaderboard');
  leaderboard.innerHTML = '';
  
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  
  sortedPlayers.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = `leaderboard-item ${player.id === socket.id ? 'current-player' : ''}`;
    item.innerHTML = `
      <span class="rank">${index + 1}</span>
      <span class="player-name">${escapeHtml(player.username)}</span>
      <span class="score">${player.score}</span>
    `;
    leaderboard.appendChild(item);
  });
  
  if (sortedPlayers.length === 0) {
    leaderboard.innerHTML = '<p style="color: #6c757d; text-align: center;">No players yet</p>';
  }
}

function updatePlayerList() {
  const playerList = document.getElementById('playerList');
  playerList.innerHTML = '';
  
  gameState.players.forEach(player => {
    const item = document.createElement('div');
    item.className = `player-item ${player.id === socket.id ? 'current-player' : ''}`;
    item.innerHTML = `
      <span class="player-indicator" style="background-color: ${player.color}"></span>
      <span>${escapeHtml(player.username)}</span>
      <span class="player-score">${player.score}</span>
    `;
    playerList.appendChild(item);
  });
  
  if (gameState.players.length === 0) {
    playerList.innerHTML = '<p style="color: #6c757d; text-align: center;">Waiting for players...</p>';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  socket.emit('leaveGame');
});

// Game loop
setInterval(() => {
  if (currentPlayer && gameState.players.length > 0) {
    draw();
  }
}, 50);
