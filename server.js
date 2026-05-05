const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const FIELD_W = 1400;
const FIELD_H = 820;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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
  message: "TEAM-CLARITY"
};

const controllers = {};

app.get("/api/qrs", async (req, res) => {
  const host = req.get("host");
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const baseUrl = `${protocol}://${host}`;

  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    const url = `${baseUrl}/controller.html?p=${i}`;
    qrs[i] = await QRCode.toDataURL(url);
  }

  res.json({ baseUrl, qrs });
});

function stopAllPlayers() {
  for (const p of Object.values(game.players)) {
    p.vx = 0;
    p.vy = 0;
  }
}

function setPlayer(number, x, y) {
  if (!game.players[number]) return;

  game.players[number].x = clamp(x, 35, FIELD_W - 35);
  game.players[number].y = clamp(y, 35, FIELD_H - 35);
  game.players[number].vx = 0;
  game.players[number].vy = 0;
}

function setupLineout(side, rawX) {
  stopAllPlayers();

  const x = clamp(rawX, 170, FIELD_W - 230);

  const topTouch = 80;
  const bottomTouch = FIELD_H - 80;

  const isTop = side === "top";

  const touchY = isTop ? topTouch : bottomTouch;
  const direction = isTop ? 1 : -1;

  const lineX = x;

  game.ball = {
    x: lineX,
    y: touchY,
    carrier: null
  };

  // Hooker / thrower on touchline
  setPlayer(2, lineX - 25, touchY + direction * 5);

  // Lineout forwards: 1,3,4,5,6,7,8
  const forwards = [1, 3, 4, 5, 6, 7, 8];
  forwards.forEach((num, idx) => {
    setPlayer(num, lineX, touchY + direction * (45 + idx * 34));
  });

  // 9 at tail / receiver
  setPlayer(9, lineX + 45, touchY + direction * 275);

  // Attacking backline
  setPlayer(10, lineX + 115, touchY + direction * 165);
  setPlayer(12, lineX + 205, touchY + direction * 190);
  setPlayer(13, lineX + 295, touchY + direction * 215);
  setPlayer(15, lineX + 385, touchY + direction * 240);
  setPlayer(14, lineX + 485, touchY + direction * 265);

  // Blind wing behind 10
  setPlayer(11, lineX + 95, touchY + direction * 115);

  game.message = isTop ? "LINEOUT TOP" : "LINEOUT BOTTOM";

  io.emit("state", game);
}

function setupScrum(rawX, rawY) {
  stopAllPlayers();

  const x = clamp(rawX, 170, FIELD_W - 360);
  const y = clamp(rawY, 170, FIELD_H - 170);

  game.ball = {
    x: x - 50,
    y: y,
    carrier: null
  };

  // Front row
  setPlayer(1, x - 35, y - 15);
  setPlayer(2, x, y - 15);
  setPlayer(3, x + 35, y - 15);

  // Locks
  setPlayer(4, x - 20, y + 25);
  setPlayer(5, x + 20, y + 25);

  // Back row
  setPlayer(6, x - 55, y + 45);
  setPlayer(7, x + 55, y + 45);
  setPlayer(8, x, y + 70);

  // 9 feeder
  setPlayer(9, x - 75, y + 15);

  // Backline
  setPlayer(10, x + 115, y - 20);
  setPlayer(12, x + 210, y - 5);
  setPlayer(13, x + 305, y + 10);
  setPlayer(15, x + 405, y + 25);
  setPlayer(14, x + 500, y + 40);

  // Blind wing behind 10
  setPlayer(11, x + 90, y - 70);

  game.message = "SCRUM";

  io.emit("state", game);
}

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
    game.ball.x = clamp(Number(data.x), 35, FIELD_W - 35);
    game.ball.y = clamp(Number(data.y), 35, FIELD_H - 35);
    game.ball.carrier = null;

    io.emit("state", game);
  });

  socket.on("coach-attach-ball", number => {
    number = Number(number);

    if (game.players[number]) {
      game.ball.carrier = number;
    }

    io.emit("state", game);
  });

  socket.on("coach-setpiece", data => {
    if (!data || !data.type) return;

    if (data.type === "lineout") {
      setupLineout(data.side, Number(data.x));
    }

    if (data.type === "scrum") {
      setupScrum(Number(data.x), Number(data.y));
    }
  });

  socket.on("coach-reset", () => {
    game.players = defaultPlayers();
    game.ball = { x: 700, y: 410, carrier: null };
    game.frozen = false;
    game.message = "TEAM-CLARITY";

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
      const len = Math.hypot(p.vx, p.vy);

      if (len > 0.05) {
        p.x += (p.vx / len) * game.speed;
        p.y += (p.vy / len) * game.speed;

        p.x = clamp(p.x, 35, FIELD_W - 35);
        p.y = clamp(p.y, 35, FIELD_H - 35);
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
  console.log("🔥 TEAM-CLARITY is running on port " + PORT);
});
