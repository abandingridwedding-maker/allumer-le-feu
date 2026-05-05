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

const TOP_TOUCH = 70;
const BOTTOM_TOUCH = FIELD_H - 70;
const TOP_5M = 125;
const TOP_15M = 220;
const BOTTOM_15M = FIELD_H - 220;
const BOTTOM_5M = FIELD_H - 125;

let currentTeamColor = "#d71920";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const controllers = {};

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
      color: currentTeamColor,
      name: `Player ${i}`
    };
  }

  for (const playerNumber of Object.values(controllers)) {
    if (players[playerNumber]) {
      players[playerNumber].connected = true;
    }
  }

  return players;
}

let game = {
  players: defaultPlayers(),
  ball: { x: 700, y: 410, carrier: null },
  frozen: false,
  speed: 4.2,
  showGrid: true,
  teamColor: currentTeamColor,
  message: "TEAM-CLARITY"
};

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

function applyTeamColor(color) {
  currentTeamColor = color;
  game.teamColor = color;

  for (const p of Object.values(game.players)) {
    p.color = color;
  }
}

function setupLineout(side, rawX) {
  stopAllPlayers();

  const x = clamp(rawX, 190, FIELD_W - 620);

  const isTop = side === "top";
  const touchY = isTop ? TOP_TOUCH : BOTTOM_TOUCH;

  const lineoutY = isTop
    ? (TOP_5M + TOP_15M) / 2
    : (BOTTOM_5M + BOTTOM_15M) / 2;

  const spreadDir = isTop ? 1 : -1;

  game.ball = {
    x: x - 18,
    y: touchY,
    carrier: null
  };

  setPlayer(2, x - 25, touchY);

  const forwards = [1, 3, 4, 5, 6, 7, 8];
  forwards.forEach((num, idx) => {
    setPlayer(num, x + idx * 24, lineoutY);
  });

  setPlayer(9, x + 205, lineoutY + spreadDir * 25);

  setPlayer(10, x + 290, isTop ? TOP_15M + 35 : BOTTOM_15M - 35);
  setPlayer(12, x + 405, isTop ? TOP_15M + 95 : BOTTOM_15M - 95);
  setPlayer(13, x + 525, isTop ? TOP_15M + 155 : BOTTOM_15M - 155);
  setPlayer(15, x + 650, isTop ? TOP_15M + 225 : BOTTOM_15M - 225);
  setPlayer(14, x + 775, isTop ? BOTTOM_15M - 40 : TOP_15M + 40);

  setPlayer(11, x + 260, isTop ? TOP_5M + 30 : BOTTOM_5M - 30);

  game.message = isTop ? "LINEOUT TOP" : "LINEOUT BOTTOM";

  io.emit("state", game);
}

function setupScrum(rawX, rawY) {
  stopAllPlayers();

  const x = clamp(rawX, 220, FIELD_W - 220);
  const y = clamp(rawY, 230, FIELD_H - 230);

  game.ball = {
    x: x - 55,
    y: y,
    carrier: null
  };

  setPlayer(1, x - 35, y - 20);
  setPlayer(2, x, y - 20);
  setPlayer(3, x + 35, y - 20);

  setPlayer(4, x - 22, y + 20);
  setPlayer(5, x + 22, y + 20);

  setPlayer(6, x - 60, y + 45);
  setPlayer(7, x + 60, y + 45);
  setPlayer(8, x, y + 75);

  setPlayer(9, x - 90, y + 45);

  const leftWingY = TOP_5M + 10;
  const topChannelY = TOP_15M + 15;
  const bottomChannelY = BOTTOM_15M - 15;
  const rightWingY = BOTTOM_5M - 10;

  if (y > 300 && y < 520) {
    setPlayer(10, x + 115, y - 70);
    setPlayer(12, x + 230, topChannelY);
    setPlayer(13, x + 350, leftWingY);

    setPlayer(15, x + 230, bottomChannelY);
    setPlayer(14, x + 350, rightWingY);

    setPlayer(11, x + 85, y + 70);
  } else {
    const midHighY = y < FIELD_H / 2 ? y + 105 : y - 105;
    const midLowY = y < FIELD_H / 2 ? y + 190 : y - 190;

    setPlayer(10, x + 120, topChannelY);
    setPlayer(12, x + 240, midHighY);
    setPlayer(13, x + 365, midLowY);
    setPlayer(15, x + 500, bottomChannelY);
    setPlayer(14, x + 620, rightWingY);

    setPlayer(11, x + 95, leftWingY);
  }

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

  socket.on("coach-team-color", color => {
    applyTeamColor(color);
    io.emit("state", game);
  });

  socket.on("coach-reset", () => {
    game.players = defaultPlayers();
    applyTeamColor(currentTeamColor);

    for (const playerNumber of Object.values(controllers)) {
      if (game.players[playerNumber]) {
        game.players[playerNumber].connected = true;
      }
    }

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
