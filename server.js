const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(__dirname));

const FIELD = {
  width: 1600,
  height: 900,
  left: 35,
  right: 1565,
  top: 72,
  bottom: 818
};

const COLORS = {
  red: "#d71920",
  white: "#ffffff",
  black: "#111111",
  blue: "#1f6feb"
};

const state = {
  sportMode: "rugby",
  pitchMode: "full",
  frozen: false,
  speed: 1,
  ball: { x: 950, y: 230 },
  players: {}
};

const controllerSockets = {};
const simulatorSockets = {};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function playableLeft() {
  return FIELD.left + 18;
}

function playableRight() {
  return FIELD.right - 18;
}

function playableTop() {
  return FIELD.top + 18;
}

function playableBottom() {
  return FIELD.bottom - 18;
}

function emitState() {
  io.emit("state", state);
}

function clampPlayer(player) {
  if (!player) return;

  player.x = clamp(player.x, playableLeft(), playableRight());
  player.y = clamp(player.y, playableTop(), playableBottom());
}

function clampBall() {
  state.ball.x = clamp(state.ball.x, playableLeft(), playableRight());
  state.ball.y = clamp(state.ball.y, playableTop(), playableBottom());
}

function clampAll() {
  Object.values(state.players).forEach(clampPlayer);
  clampBall();
}

function initPlayers() {
  state.players = {};

  for (let i = 1; i <= 15; i++) {
    state.players[i] = {
      number: i,
      x: 500,
      y: 300,
      color: COLORS.red,
      connected: false
    };
  }

  placeLineout("top", 920);
}

function placeLineout(side, x) {
  if (!state || !state.players || !state.ball) return;

  const xForwards = clamp(x || 920, FIELD.left + 220, FIELD.right - 520);
  const spacing = side === "top" ? 34 : -34;
  const startY = side === "top" ? FIELD.top + 72 : FIELD.bottom - 72;
  const players = state.players;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    players[n].x = xForwards;
    players[n].y = startY + i * spacing;
  });

  players[2].x = xForwards - 78;
  players[2].y = startY - spacing * 0.2;

  players[9].x = xForwards + 76;
  players[9].y = startY + spacing * 4.2;

  const backsStartX = clamp(xForwards + 185, FIELD.left + 120, FIELD.right - 100);

  players[10].x = backsStartX;
  players[10].y = clamp(startY + spacing * 3.5, FIELD.top + 50, FIELD.bottom - 50);

  players[12].x = clamp(backsStartX + 105, FIELD.left + 100, FIELD.right - 70);
  players[12].y = clamp(startY + spacing * 4.3, FIELD.top + 50, FIELD.bottom - 50);

  players[13].x = clamp(backsStartX + 220, FIELD.left + 100, FIELD.right - 70);
  players[13].y = clamp(startY + spacing * 5.0, FIELD.top + 50, FIELD.bottom - 50);

  players[15].x = clamp(backsStartX + 330, FIELD.left + 100, FIELD.right - 70);
  players[15].y = clamp(startY + spacing * 5.9, FIELD.top + 50, FIELD.bottom - 50);

  players[14].x = clamp(backsStartX + 435, FIELD.left + 100, FIELD.right - 70);
  players[14].y = clamp(startY + spacing * 6.8, FIELD.top + 50, FIELD.bottom - 50);

  players[11].x = clamp(backsStartX + 160, FIELD.left + 100, FIELD.right - 70);
  players[11].y = clamp(startY + spacing * 1.6, FIELD.top + 50, FIELD.bottom - 50);

  state.ball.x = xForwards + 34;
  state.ball.y = startY + spacing * 1.4;

  clampAll();
}

function placeScrum(x, y) {
  if (!state || !state.players || !state.ball) return;

  const players = state.players;
  const cx = clamp(x || 720, FIELD.left + 180, FIELD.right - 580);
  const cy = clamp(y || 445, FIELD.top + 155, FIELD.bottom - 220);

  const gapX = 38;
  const gapY = 38;

  players[1].x = cx - gapX;
  players[1].y = cy - gapY;

  players[2].x = cx;
  players[2].y = cy - gapY;

  players[3].x = cx + gapX;
  players[3].y = cy - gapY;

  players[4].x = cx - 19;
  players[4].y = cy;

  players[5].x = cx + 19;
  players[5].y = cy;

  players[6].x = cx - 66;
  players[6].y = cy + gapY;

  players[7].x = cx + 66;
  players[7].y = cy + gapY;

  players[8].x = cx;
  players[8].y = cy + gapY + 18;

  players[9].x = cx + 150;
  players[9].y = cy + 14;

  players[10].x = clamp(cx + 265, FIELD.left + 100, FIELD.right - 70);
  players[10].y = clamp(cy + 42, FIELD.top + 50, FIELD.bottom - 50);

  players[12].x = clamp(cx + 375, FIELD.left + 100, FIELD.right - 70);
  players[12].y = clamp(cy + 82, FIELD.top + 50, FIELD.bottom - 50);

  players[13].x = clamp(cx + 500, FIELD.left + 100, FIELD.right - 70);
  players[13].y = clamp(cy + 132, FIELD.top + 50, FIELD.bottom - 50);

  players[15].x = clamp(cx + 605, FIELD.left + 100, FIELD.right - 70);
  players[15].y = clamp(cy + 195, FIELD.top + 50, FIELD.bottom - 50);

  players[14].x = clamp(cx + 710, FIELD.left + 100, FIELD.right - 70);
  players[14].y = clamp(cy + 245, FIELD.top + 50, FIELD.bottom - 50);

  players[11].x = clamp(cx + 440, FIELD.left + 100, FIELD.right - 70);
  players[11].y = clamp(cy - 118, FIELD.top + 50, FIELD.bottom - 50);

  state.ball.x = cx + 105;
  state.ball.y = cy + 8;

  clampAll();
}

initPlayers();

function getBaseUrl(req) {
  return process.env.RENDER_EXTERNAL_URL || `https://${req.get("host")}`;
}

app.get("/api/qrs", async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    qrs[i] = await QRCode.toDataURL(`${baseUrl}/controller.html?p=${i}`);
  }

  res.json({ baseUrl, qrs });
});

app.get("/api/sim-qrs", async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    qrs[i] = await QRCode.toDataURL(`${baseUrl}/simcontroller.html?p=${i}`);
  }

  res.json({ baseUrl, qrs });
});

io.on("connection", socket => {
  socket.emit("state", state);

  function connectPlayer(number) {
    number = Number(number);
    if (!state.players[number]) return;

    controllerSockets[socket.id] = number;
    state.players[number].connected = true;

    socket.emit("live-controller-ack", { number });
    emitState();
  }

  socket.on("controller-connect", connectPlayer);
  socket.on("controller-join", connectPlayer);
  socket.on("player-join", connectPlayer);
  socket.on("join-player", connectPlayer);

  socket.on("controller-move", data => {
    if (state.frozen || !data) return;

    const number = Number(data.number || controllerSockets[socket.id]);
    const player = state.players[number];

    if (!player) return;

    const speed = Number(state.speed || 1);
    const step = 6.5 * speed;

    player.x += Number(data.dx || 0) * step;
    player.y += Number(data.dy || 0) * step;

    clampPlayer(player);
    emitState();
  });

  socket.on("coach-move-player", data => {
    if (!data) return;

    const player = state.players[Number(data.number)];
    if (!player) return;

    player.x = clamp(Number(data.x), playableLeft(), playableRight());
    player.y = clamp(Number(data.y), playableTop(), playableBottom());

    emitState();
  });

  socket.on("coach-ball", data => {
    if (!data) return;

    state.ball.x = clamp(Number(data.x), playableLeft(), playableRight());
    state.ball.y = clamp(Number(data.y), playableTop(), playableBottom());

    emitState();
  });

  socket.on("coach-attach-ball", number => {
    const player = state.players[Number(number)];
    if (!player) return;

    state.ball.x = player.x + 28;
    state.ball.y = player.y - 10;

    clampAll();
    emitState();
  });

  socket.on("coach-reset", () => {
    placeLineout("top", 920);
    emitState();
  });

  socket.on("coach-freeze", frozen => {
    state.frozen = Boolean(frozen);
    emitState();
  });

  socket.on("coach-speed", speed => {
    state.speed = Number(speed || 1);
    emitState();
  });

  socket.on("coach-pitch-mode", mode => {
    state.pitchMode = mode || "full";
    emitState();
  });

  socket.on("coach-sport-mode", mode => {
    state.sportMode = mode || "rugby";
    emitState();
  });

  socket.on("coach-setpiece", data => {
    if (!data) return;

    if (data.type === "lineout") {
      placeLineout(data.side || "top", data.x || 920);
    }

    if (data.type === "scrum") {
      placeScrum(data.x || 720, data.y || 445);
    }

    emitState();
  });

  socket.on("sim-player-join", number => {
    number = Number(number);
    simulatorSockets[socket.id] = number;

    socket.emit("sim-controller-ack", { number });

    io.emit("sim-player-connected", {
      number,
      connected: true
    });
  });

  socket.on("sim-player-move", data => {
    if (!data) return;

    io.emit("sim-player-move", {
      number: Number(data.number || simulatorSockets[socket.id]),
      dx: Number(data.dx || 0),
      dy: Number(data.dy || 0)
    });
  });

  socket.on("disconnect", () => {
    const number = controllerSockets[socket.id];

    if (number && state.players[number]) {
      state.players[number].connected = false;
      emitState();
    }

    delete controllerSockets[socket.id];
    delete simulatorSockets[socket.id];
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🔥 TEAM-CLARITY running on port", PORT);
});