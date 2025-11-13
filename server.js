const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users
const users = new Map();

// Game state
const gameState = {
  players: new Map(),
  food: { x: 0, y: 0 },
  gameRunning: false,
  gameId: null
};

// Generate random food position
function generateFood() {
  const gridSize = 20;
  return {
    x: Math.floor(Math.random() * (400 / gridSize)) * gridSize,
    y: Math.floor(Math.random() * (400 / gridSize)) * gridSize
  };
}

// Initialize game food
gameState.food = generateFood();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle user joining
  socket.on('join', (data) => {
    const username = typeof data === 'string' ? data : data.username;
    const avatar = typeof data === 'object' ? data.avatar : null;
    
    users.set(socket.id, { username, avatar });
    socket.username = username;
    socket.avatar = avatar;
    
    // Broadcast to all clients that a user joined
    io.emit('userJoined', {
      username: username,
      avatar: avatar,
      message: `${username} joined the chat`,
      timestamp: new Date().toISOString()
    });

    // Send current user list with avatars to the newly connected user
    const userList = Array.from(users.values()).map(u => ({
      username: typeof u === 'string' ? u : u.username,
      avatar: typeof u === 'object' ? u.avatar : null
    }));
    socket.emit('userList', userList);
    
    // Broadcast updated user list to all clients
    io.emit('userList', userList);
    
    console.log(`${username} joined the chat`);
  });

  // Handle incoming messages
  socket.on('message', (data) => {
    const userData = users.get(socket.id);
    const messageData = {
      username: socket.username || 'Anonymous',
      avatar: socket.avatar || (userData && typeof userData === 'object' ? userData.avatar : null),
      message: data.message,
      timestamp: new Date().toISOString(),
      id: socket.id
    };
    
    // Broadcast message to all clients
    io.emit('message', messageData);
    console.log(`Message from ${messageData.username}: ${messageData.message}`);
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', {
      username: socket.username || 'Anonymous',
      isTyping: data.isTyping
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const username = socket.username || 'Unknown';
    users.delete(socket.id);
    
    // Remove player from game if they were playing
    if (gameState.players.has(socket.id)) {
      gameState.players.delete(socket.id);
      io.emit('playerLeft', { playerId: socket.id });
    }
    
    // Broadcast to all clients that a user left
    io.emit('userLeft', {
      username: username,
      message: `${username} left the chat`,
      timestamp: new Date().toISOString()
    });
    
    // Broadcast updated user list
    io.emit('userList', Array.from(users.values()));
    
    console.log(`${username} disconnected`);
  });

  // Game socket handlers
  socket.on('joinGame', (data) => {
    const username = socket.username || 'Anonymous';
    const playerId = socket.id;
    
    // Initialize player
    gameState.players.set(playerId, {
      id: playerId,
      username: username,
      snake: [{ x: Math.floor(Math.random() * 20) * 20, y: Math.floor(Math.random() * 20) * 20 }],
      direction: { x: 20, y: 0 },
      score: 0,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    });
    
    socket.emit('gameState', {
      players: Array.from(gameState.players.values()),
      food: gameState.food,
      gameRunning: gameState.gameRunning
    });
    
    io.emit('playerJoined', {
      playerId: playerId,
      username: username,
      players: Array.from(gameState.players.values())
    });
    
    console.log(`${username} joined the game`);
  });

  socket.on('playerMove', (data) => {
    if (gameState.players.has(socket.id)) {
      const player = gameState.players.get(socket.id);
      player.direction = data.direction;
    }
  });

  socket.on('leaveGame', () => {
    if (gameState.players.has(socket.id)) {
      gameState.players.delete(socket.id);
      io.emit('playerLeft', { 
        playerId: socket.id,
        players: Array.from(gameState.players.values())
      });
    }
  });
});

// Game loop - update game state every 100ms
setInterval(() => {
  if (gameState.players.size > 0) {
    gameState.gameRunning = true;
    
    // Update each player's snake
    gameState.players.forEach((player, playerId) => {
      const head = { ...player.snake[0] };
      head.x += player.direction.x;
      head.y += player.direction.y;
      
      // Wrap around screen
      if (head.x < 0) head.x = 380;
      if (head.x >= 400) head.x = 0;
      if (head.y < 0) head.y = 380;
      if (head.y >= 400) head.y = 0;
      
      // Check collision with self
      const selfCollision = player.snake.some((segment, index) => {
        if (index === 0) return false;
        return segment.x === head.x && segment.y === head.y;
      });
      
      if (selfCollision) {
        // Reset player
        player.snake = [{ x: Math.floor(Math.random() * 20) * 20, y: Math.floor(Math.random() * 20) * 20 }];
        player.score = 0;
        player.direction = { x: 20, y: 0 };
      } else {
        player.snake.unshift(head);
        
        // Check if food eaten
        if (head.x === gameState.food.x && head.y === gameState.food.y) {
          player.score += 10;
          gameState.food = generateFood();
        } else {
          player.snake.pop();
        }
      }
    });
    
    // Broadcast updated game state
    io.emit('gameUpdate', {
      players: Array.from(gameState.players.values()),
      food: gameState.food
    });
  } else {
    gameState.gameRunning = false;
  }
}, 100);

const PORT = process.env.PORT || 3000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Chat available at: http://localhost:${PORT}`);
  console.log(`Game available at: http://localhost:${PORT}/game.html`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
  } else {
    console.error('Failed to start server:', err);
  }
  process.exit(1);
});
