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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle user joining
  socket.on('join', (username) => {
    users.set(socket.id, username);
    socket.username = username;
    
    // Broadcast to all clients that a user joined
    io.emit('userJoined', {
      username: username,
      message: `${username} joined the chat`,
      timestamp: new Date().toISOString()
    });

    // Send current user list to the newly connected user
    socket.emit('userList', Array.from(users.values()));
    
    // Broadcast updated user list to all clients
    io.emit('userList', Array.from(users.values()));
    
    console.log(`${username} joined the chat`);
  });

  // Handle incoming messages
  socket.on('message', (data) => {
    const messageData = {
      username: socket.username || 'Anonymous',
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
