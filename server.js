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
  const players = state.players;
  const xForwards = clamp(x || 920, FIELD.left + 240, FIELD.right - 520);
  const isTop = side === "top";
  const baseY = isTop ? FIELD.top + 92 : FIELD.bottom - 55;
  const dir = isTop ? 1 : -1;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    players[n].x = xForwards;
    players[n].y = baseY + i * 23 * dir;
  });

  players[2].x = xForwards - 70;
  players[2].y = baseY - 36 * dir;

  players[9].x = xForwards + 115;
  players[9].y = baseY + 35 * dir;

  players[10].x = xForwards + 210;
  players[10].y = baseY + 155 * dir;

  players[14].x = xForwards + 280;
  players[14].y = baseY + 105 * dir;

  players[12].x = xForwards + 225;
  players[12].y = baseY + 250 * dir;

  players[13].x = xForwards + 270;
  players[13].y = baseY + 360 * dir;

  players[15].x = xForwards + 315;
  players[15].y = baseY + 480 * dir;

  players[11].x = xForwards + 355;
  players[11].y = baseY + 610 * dir;

  state.ball.x = xForwards - 55;
  state.ball.y = baseY + 315 * dir;

  clampAll();
}

function placeScrum(x, y) {
  const players = state.players;
  const cx = clamp(x || 880, FIELD.left + 260, FIELD.right - 560);
  const isTop = !y || y < FIELD.height / 2;
  const cy = isTop ? FIELD.top + 215 : FIELD.bottom - 215;
  const dir = isTop ? 1 : -1;

  players[1].x = cx - 45; players[1].y = cy + 45 * dir;
  players[2].x = cx - 45; players[2].y = cy;
  players[3].x = cx - 45; players[3].y = cy - 45 * dir;

  players[4].x = cx; players[4].y = cy + 25 * dir;
  players[5].x = cx; players[5].y = cy - 20 * dir;

  if (isTop) {
    players[6].x = cx + 42; players[6].y = cy - 62 * dir;
    players[7].x = cx + 42; players[7].y = cy + 62 * dir;
  } else {
    players[6].x = cx + 42; players[6].y = cy + 62 * dir;
    players[7].x = cx + 42; players[7].y = cy - 62 * dir;
  }

  players[8].x = cx + 40;
  players[8].y = cy;

  players[9].x = cx + 110;
  players[9].y = cy;

  const baseY = isTop ? FIELD.top + 92 : FIELD.bottom - 55;
  const xForwards = cx;

  players[10].x = xForwards + 210;
  players[10].y = baseY + 155 * dir;

  players[14].x = xForwards + 280;
  players[14].y = baseY + 105 * dir;

  players[12].x = xForwards + 225;
  players[12].y = baseY + 250 * dir;

  players[13].x = xForwards + 270;
  players[13].y = baseY + 360 * dir;

  players[15].x = xForwards + 315;
  players[15].y = baseY + 480 * dir;

  players[11].x = xForwards + 355;
  players[11].y = baseY + 610 * dir;

  state.ball.x = cx + 70;
  state.ball.y = cy - 10 * dir;

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
socket.on("coach-full-state", data => {
  if (!data) return;

  if (data.players) {
    Object.keys(data.players).forEach(number => {
      if (!state.players[number]) return;

      state.players[number].x = clamp(
        Number(data.players[number].x),
        playableLeft(),
        playableRight()
      );

      state.players[number].y = clamp(
        Number(data.players[number].y),
        playableTop(),
        playableBottom()
      );
    });
  }

  if (data.ball) {
    state.ball.x = clamp(
      Number(data.ball.x),
      playableLeft(),
      playableRight()
    );

    state.ball.y = clamp(
      Number(data.ball.y),
      playableTop(),
      playableBottom()
    );
  }

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