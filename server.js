// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Store connected users
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('🟢 New client connected');

  // When client sends something
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    // When first message is "join"
    if (data.type === 'join') {
      clients.set(ws, data.user);
      broadcastSystem(`${data.user} joined the chat 💬`);
      broadcastUserList();
      return;
    }

    // When a user is typing
    if (data.type === 'typing') {
      broadcastTyping(data.user);
      return;
    }

    // When stops typing
    if (data.type === "stopTyping") {
      broadcastStopTyping(data.user);
      return;
    }

   // Normal message
    if (data.type === "chat") {
      const msg = JSON.stringify({
        type: "chat",
        user: data.user,
        msg: data.msg,
        time: data.time,
      });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    }
  });


  // When someone disconnects
  ws.on('close', () => {
    const username = clients.get(ws);
    clients.delete(ws);
    if (username) broadcastSystem(`${username} left the chat 🚪`);
    broadcastUserList();
    console.log('🔴 Client disconnected');
  });
});

function broadcastSystem(text) {
  const msg = JSON.stringify({
    type: "system",
    msg: text,
    time: new Date().toLocaleTimeString(),
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function broadcastTyping(user) {
  const msg = JSON.stringify({ type: "typing", user });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function broadcastStopTyping(user) {
  const msg = JSON.stringify({ type: "stopTyping", user });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function broadcastUserList() {
  const users = Array.from(clients.values());
  const msg = JSON.stringify({ type: "userList", users });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

const PORT = 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);