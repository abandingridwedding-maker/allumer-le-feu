const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (data) => {
    socket.broadcast.emit("playerJoined", data);
  });

  socket.on("move", (data) => {
    socket.broadcast.emit("move", data);
  });

  socket.on("ballMove", (data) => {
    socket.broadcast.emit("ballMove", data);
  });

  socket.on("reset", (data) => {
    io.emit("reset", data);
  });

  socket.on("freeze", (data) => {
    io.emit("freeze", data);
  });

  socket.on("layoutChange", (data) => {
    io.emit("layoutChange", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
