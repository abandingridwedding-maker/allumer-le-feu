const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

const FIELD_W = 1400;
const FIELD_H = 820;

function defaultPlayers() {
  const players = {};
  for (let i = 1; i <= 15; i++) {
    const row = i <= 8 ? 0 : 1;
    const index = row === 0 ? i - 1 : i - 9;
    players[i] = {
      id: i,
      number: i,
      x: row === 0 ? 235 + index * 95 : 290 + index * 120,
      y: row === 0 ? 335 : 500,
      vx: 0,
      vy: 0,
      connected: false,
      frozen: false,
      color: i <= 8 ? "#d71920" : "#111111",
      name: `Player ${i}`
    };
  }
  return players;
}

let game = {
  players: defaultPlayers(),
  ball: { x: 700, y: 410, carrier: null },
  frozen: false,
  speed: 4.2,
  showGrid: true,
  message: "ALLUMER LE FEU"
};

const controllers = {};

app.get("/api/qrs", async (req, res) => {
  // IMPORTANT:
  // Do NOT use req.get("host") here, because if the coach opens localhost,
  // the QR code would also become localhost, which phones cannot use.
  // Always use the laptop's local Wi-Fi IP instead.
  const localIP = getLocalIP();
  const baseUrl = `http://${localIP}:${PORT}`;
  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    const url = `${baseUrl}/controller.html?p=${i}`;
    qrs[i] = await QRCode.toDataURL(url);
  }

  res.json({ baseUrl, qrs });
});

io.on("connection", socket => {
  socket.emit("state", game);

  socket.on("join-player", number => {
    number = Number(number);
    if (!game.players[number]) return;
    controllers[socket.id] = number;
    game.players[number].connected = true;
    io.emit("state", game);
  });

  socket.on("move", data => {
    const number = controllers[socket.id];
    if (!number || !game.players[number]) return;
    const p = game.players[number];
    p.vx = Math.max(-1, Math.min(1, Number(data.x) || 0));
    p.vy = Math.max(-1, Math.min(1, Number(data.y) || 0));
  });

  socket.on("coach-ball", data => {
    game.ball.x = Math.max(40, Math.min(FIELD_W - 40, Number(data.x)));
    game.ball.y = Math.max(40, Math.min(FIELD_H - 40, Number(data.y)));
    game.ball.carrier = null;
    io.emit("state", game);
  });

  socket.on("coach-attach-ball", number => {
    number = Number(number);
    if (game.players[number]) {
      game.ball.carrier = number;
      io.emit("state", game);
    }
  });

  socket.on("coach-reset", () => {
    game.players = defaultPlayers();
    game.ball = { x: 700, y: 410, carrier: null };
    game.frozen = false;
    game.message = "ALLUMER LE FEU";
    io.emit("state", game);
  });

  socket.on("coach-freeze", value => {
    game.frozen = !!value;
    io.emit("state", game);
  });

  socket.on("coach-grid", value => {
    game.showGrid = !!value;
    io.emit("state", game);
  });

  socket.on("coach-speed", value => {
    game.speed = Math.max(1, Math.min(9, Number(value) || 4.2));
    io.emit("state", game);
  });

  socket.on("disconnect", () => {
    const number = controllers[socket.id];
    delete controllers[socket.id];
    if (number && game.players[number]) {
      game.players[number].connected = false;
      game.players[number].vx = 0;
      game.players[number].vy = 0;
    }
    io.emit("state", game);
  });
});

setInterval(() => {
  if (!game.frozen) {
    for (const p of Object.values(game.players)) {
      if (p.frozen) continue;
      const len = Math.hypot(p.vx, p.vy);
      if (len > 0.05) {
        const nx = p.vx / Math.max(1, len);
        const ny = p.vy / Math.max(1, len);
        p.x += nx * game.speed;
        p.y += ny * game.speed;
        p.x = Math.max(35, Math.min(FIELD_W - 35, p.x));
        p.y = Math.max(35, Math.min(FIELD_H - 35, p.y));
      }
    }
    if (game.ball.carrier && game.players[game.ball.carrier]) {
      const c = game.players[game.ball.carrier];
      game.ball.x = c.x + 30;
      game.ball.y = c.y + 5;
    }
  }
  io.emit("state", game);
}, 1000 / 30);

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("🔥 ALLUMER LE FEU is running");
  console.log(`Coach screen: http://${getLocalIP()}:${PORT}`);
  console.log(`Same computer: http://localhost:${PORT}`);
  console.log("");
});app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
