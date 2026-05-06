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
  topMargin: 120,
  bottomMargin: 140,
  sideMargin: 70
};

const COLORS = {
  red: "#d71920",
  white: "#ffffff",
  black: "#111111",
  blue: "#1f6feb"
};

const state = {
  sportMode: "rugby",
  frozen: false,
  speed: 1,
  ball: { x: 900, y: 450 },
  players: {}
};

const controllerSockets = {};
const simulatorSockets = {};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function playableLeft() {
  return FIELD.sideMargin;
}

function playableRight() {
  return FIELD.width - FIELD.sideMargin;
}

function playableTop() {
  return FIELD.topMargin;
}

function playableBottom() {
  return FIELD.height - FIELD.bottomMargin;
}

function emitState() {
  io.emit("state", state);
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

  applyLineoutTop();
}

/* ================================
   TEAM-CLARITY SHAPES
   Always RIGHT → LEFT
================================ */

function applyLineoutTop() {
  const xForwards = 920;
  const startY = 160;
  const spacing = 42;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    state.players[n].x = xForwards;
    state.players[n].y = startY + i * spacing;
  });

  state.players[2].x = xForwards - 78;
  state.players[2].y = startY - 2;

  state.players[9].x = xForwards + 80;
  state.players[9].y = startY + 4.4 * spacing;

  state.players[10].x = xForwards + 190;
  state.players[10].y = startY + 3.6 * spacing;

  state.players[12].x = xForwards + 290;
  state.players[12].y = startY + 4.4 * spacing;

  state.players[13].x = xForwards + 405;
  state.players[13].y = startY + 5.2 * spacing;

  state.players[15].x = xForwards + 515;
  state.players[15].y = startY + 6.1 * spacing;

  state.players[14].x = xForwards + 620;
  state.players[14].y = startY + 7.0 * spacing;

  state.players[11].x = xForwards + 260;
  state.players[11].y = startY + 1.5 * spacing;

  state.ball.x = xForwards + 35;
  state.ball.y = startY + 48;

  clampAll();
}

function applyLineoutBottom() {
  const xForwards = 920;
  const startY = 720;
  const spacing = -42;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    state.players[n].x = xForwards;
    state.players[n].y = startY + i * spacing;
  });

  state.players[2].x = xForwards - 78;
  state.players[2].y = startY + 2;

  state.players[9].x = xForwards + 80;
  state.players[9].y = startY + 4.4 * spacing;

  state.players[10].x = xForwards + 190;
  state.players[10].y = startY + 3.6 * spacing;

  state.players[12].x = xForwards + 290;
  state.players[12].y = startY + 4.4 * spacing;

  state.players[13].x = xForwards + 405;
  state.players[13].y = startY + 5.2 * spacing;

  state.players[15].x = xForwards + 515;
  state.players[15].y = startY + 6.1 * spacing;

  state.players[14].x = xForwards + 620;
  state.players[14].y = startY + 7.0 * spacing;

  state.players[11].x = xForwards + 260;
  state.players[11].y = startY + 1.5 * spacing;

  state.ball.x = xForwards + 35;
  state.ball.y = startY - 48;

  clampAll();
}

function applyScrum() {
  const cx = 720;
  const cy = 445;
  const gap = 42;

  state.players[1].x = cx - gap;
  state.players[1].y = cy - gap;

  state.players[2].x = cx;
  state.players[2].y = cy - gap;

  state.players[3].x = cx + gap;
  state.players[3].y = cy - gap;

  state.players[4].x = cx - 22;
  state.players[4].y = cy;

  state.players[5].x = cx + 22;
  state.players[5].y = cy;

  state.players[6].x = cx - 72;
  state.players[6].y = cy + gap;

  state.players[7].x = cx + 72;
  state.players[7].y = cy + gap;

  state.players[8].x = cx;
  state.players[8].y = cy + gap + 20;

  state.players[9].x = cx + 165;
  state.players[9].y = cy + 18;

  state.players[10].x = cx + 285;
  state.players[10].y = cy + 48;

  state.players[12].x = cx + 395;
  state.players[12].y = cy + 90;

  state.players[13].x = cx + 520;
  state.players[13].y = cy + 140;

  state.players[15].x = cx + 625;
  state.players[15].y = cy + 205;

  state.players[14].x = cx + 735;
  state.players[14].y = cy + 255;

  state.players[11].x = cx + 455;
  state.players[11].y = cy - 120;

  state.ball.x = cx + 112;
  state.ball.y = cy + 12;

  clampAll();
}

function clampAll() {
  Object.values(state.players).forEach(p => {
    p.x = clamp(p.x, playableLeft(), playableRight());
    p.y = clamp(p.y, playableTop(), playableBottom());
  });

  state.ball.x = clamp(state.ball.x, playableLeft(), playableRight());
  state.ball.y = clamp(state.ball.y, playableTop(), playableBottom());
}

initPlayers();

/* ================================
   QR APIS
================================ */

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

/* ================================
   SOCKETS
================================ */

io.on("connection", socket => {
  socket.emit("state", state);

  // CLARITY LIVE CONTROLLERS
  socket.on("controller-connect", number => {
    number = Number(number);
    controllerSockets[socket.id] = number;

    if (state.players[number]) {
      state.players[number].connected = true;
    }

    emitState();
  });

  socket.on("controller-move", data => {
    if (state.frozen) return;

    const number = controllerSockets[socket.id];
    if (!number) return;

    const player = state.players[number];
    if (!player) return;

    const speed = Number(state.speed || 1);

    player.x += Number(data.dx || 0) * 7 * speed;
    player.y += Number(data.dy || 0) * 7 * speed;

    player.x = clamp(player.x, playableLeft(), playableRight());
    player.y = clamp(player.y, playableTop(), playableBottom());

    emitState();
  });

  // backwards compatibility for old controller.js if cached
  socket.on("player-join", number => {
    socket.emit("controller-connect", number);
  });

  socket.on("join-player", number => {
    socket.emit("controller-connect", number);
  });

  socket.on("controller-join", number => {
    socket.emit("controller-connect", number);
  });

  socket.on("player-move", data => {
    if (state.frozen || !data) return;

    const number = Number(data.number || controllerSockets[socket.id]);
    const player = state.players[number];

    if (!player) return;

    const speed = Number(state.speed || 1);

    player.x += Number(data.dx || 0) * 7 * speed;
    player.y += Number(data.dy || 0) * 7 * speed;

    player.x = clamp(player.x, playableLeft(), playableRight());
    player.y = clamp(player.y, playableTop(), playableBottom());

    emitState();
  });

  // COACH CONTROLS
  socket.on("coach-move-player", data => {
    if (state.frozen || !data) return;

    const p = state.players[Number(data.number)];
    if (!p) return;

    p.x = clamp(Number(data.x), playableLeft(), playableRight());
    p.y = clamp(Number(data.y), playableTop(), playableBottom());

    emitState();
  });

  socket.on("coach-ball", data => {
    if (state.frozen || !data) return;

    state.ball.x = clamp(Number(data.x), playableLeft(), playableRight());
    state.ball.y = clamp(Number(data.y), playableTop(), playableBottom());

    emitState();
  });

  socket.on("coach-attach-ball", number => {
    const p = state.players[Number(number)];
    if (!p) return;

    state.ball.x = clamp(p.x + 28, playableLeft(), playableRight());
    state.ball.y = clamp(p.y - 10, playableTop(), playableBottom());

    emitState();
  });

  socket.on("coach-reset", () => {
    applyLineoutTop();
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

  socket.on("coach-team-color", color => {
    const finalColor = COLORS[color] || COLORS.red;

    Object.values(state.players).forEach(p => {
      p.color = finalColor;
    });

    emitState();
  });

  socket.on("coach-sport-mode", mode => {
    state.sportMode = mode;
    emitState();
  });

  socket.on("coach-setpiece", data => {
    if (!data) return;

    if (data.type === "lineout" && data.side === "top") {
      applyLineoutTop();
    }

    if (data.type === "lineout" && data.side === "bottom") {
      applyLineoutBottom();
    }

    if (data.type === "scrum") {
      applyScrum();
    }

    emitState();
  });

  // PLAYER SIMULATOR CONTROLLERS
  socket.on("sim-player-join", number => {
    number = Number(number);
    simulatorSockets[socket.id] = number;

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

  socket.on("sim-player-timing", data => {
    io.emit("sim-player-timing", {
      number: Number(data?.number || simulatorSockets[socket.id])
    });
  });

  socket.on("sim-reset", () => {
    io.emit("sim-reset");
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
