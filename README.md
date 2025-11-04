# Interactive Group Chat

A real-time group chat application built with Node.js, Express, and Socket.IO. Features include real-time messaging, user presence indicators, typing indicators, and a modern, beautiful UI.

## Features

- 💬 Real-time messaging
- 👥 Online user list
- ⌨️ Typing indicators
- 🎨 Modern, responsive UI
- 🔔 User join/leave notifications
- 📱 Mobile-friendly design

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

## Running the Application

Start the server:
```bash
npm start
```

The server will start on `http://localhost:3000` by default.

Open your browser and navigate to `http://localhost:3000` to access the chat application.

Open multiple browser windows/tabs to test the group chat functionality with multiple users.

## Usage

1. Enter your username when prompted
2. Start chatting with other users in real-time
3. See who's online in the sidebar
4. Watch for typing indicators when others are typing
5. See notifications when users join or leave

## Project Structure

```
.
├── server.js          # Node.js server with Socket.IO
├── package.json       # Project dependencies
├── public/
│   ├── index.html    # Main HTML file
│   ├── client.js     # Client-side JavaScript
│   └── style.css     # Styling
└── README.md         # This file
```

## Technologies Used

- **Node.js** - Server runtime
- **Express** - Web framework
- **Socket.IO** - Real-time bidirectional communication
- **HTML/CSS/JavaScript** - Frontend

## License

MIT
