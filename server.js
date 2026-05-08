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
  bottomMargin: 145,
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

function activeField() {
  if (state.pitchMode === "lineout") {
    const lineoutWidth = Math.round((FIELD.width - FIELD.sideMargin * 2) * 0.62);
    const left = Math.round((FIELD.width - lineoutWidth) / 2);
    return {
      left,
      right: left + lineoutWidth,
      top: FIELD.topMargin - 25,
      bottom: FIELD.height - FIELD.bottomMargin
    };
  }

  return {
    left: FIELD.sideMargin,
    right: FIELD.width - FIELD.sideMargin,
    top: FIELD.topMargin - 25,
    bottom: FIELD.height - FIELD.bottomMargin
  };
}

function playableLeft() {
  return activeField().left + 22;
}

function playableRight() {
  return activeField().right - 22;
}

function playableTop() {
  return activeField().top + 24;
}

function playableBottom() {
  return activeField().bottom - 24;
}

function emitState() {
  io.emit("state", state);
}

function clampAll() {
  Object.values(state.players).forEach(p => {
    p.x = clamp(p.x, playableLeft(), playableRight());
    p.y = clamp(p.y, playableTop(), playableBottom());
  });

  state.ball.x = clamp(state.ball.x, playableLeft(), playableRight());
  state.ball.y = clamp(state.ball.y, playableTop(), playableBottom());
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

/* ================================
   TEAM-CLARITY STANDARD SHAPES
   Always RIGHT → LEFT
================================ */

function placeLineout(side = "top", clickedX = 920) {
  const xForwards = clamp(
    Number(clickedX) || 920,
    playableLeft() + 200,
    playableRight() - 520
  );

  const spacing = side === "top" ? 34 : -34;
  const startY = side === "top" ? FIELD.topMargin + 72 : FIELD.height - FIELD.bottomMargin - 72;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    state.players[n].x = xForwards;
    state.players[n].y = startY + i * spacing;
  });

  state.players[2].x = xForwards - 78;
  state.players[2].y = startY - spacing * 0.2;

  state.players[9].x = xForwards + 76;
  state.players[9].y = startY + spacing * 4.2;

  const backsStartX = clamp(xForwards + 185, playableLeft() + 100, playableRight() - 100);

  state.players[10].x = backsStartX;
  state.players[10].y = clamp(startY + spacing * 3.5, playableTop() + 20, playableBottom() - 20);

  state.players[12].x = clamp(backsStartX + 105, playableLeft(), playableRight());
  state.players[12].y = clamp(startY + spacing * 4.3, playableTop() + 20, playableBottom() - 20);

  state.players[13].x = clamp(backsStartX + 220, playableLeft(), playableRight());
  state.players[13].y = clamp(startY + spacing * 5.0, playableTop() + 20, playableBottom() - 20);

  state.players[15].x = clamp(backsStartX + 330, playableLeft(), playableRight());
  state.players[15].y = clamp(startY + spacing * 5.9, playableTop() + 20, playableBottom() - 20);

  state.players[14].x = clamp(backsStartX + 435, playableLeft(), playableRight());
  state.players[14].y = clamp(startY + spacing * 6.8, playableTop() + 20, playableBottom() - 20);

  state.players[11].x = clamp(backsStartX + 160, playableLeft(), playableRight());
  state.players[11].y = clamp(startY + spacing * 1.6, playableTop() + 20, playableBottom() - 20);

  state.ball.x = xForwards + 34;
  state.ball.y = startY + spacing * 1.4;

  clampAll();
}

function placeScrum(clickedX = 720, clickedY = 445) {
  const cx = clamp(
    Number(clickedX) || 720,
    playableLeft() + 160,
    playableRight() - 580
  );

  const cy = clamp(
    Number(clickedY) || 445,
    playableTop() + 140,
    playableBottom() - 200
  );

  const gapX = 38;
  const gapY = 38;

  state.players[1].x = cx - gapX;
  state.players[1].y = cy - gapY;

  state.players[2].x = cx;
  state.players[2].y = cy - gapY;

  state.players[3].x = cx + gapX;
  state.players[3].y = cy - gapY;

  state.players[4].x = cx - 19;
  state.players[4].y = cy;

  state.players[5].x = cx + 19;
  state.players[5].y = cy;

  state.players[6].x = cx - 66;
  state.players[6].y = cy + gapY;

  state.players[7].x = cx + 66;
  state.players[7].y = cy + gapY;

  state.players[8].x = cx;
  state.players[8].y = cy + gapY + 18;

  state.players[9].x = cx + 150;
  state.players[9].y = cy + 14;

  state.players[10].x = clamp(cx + 265, playableLeft(), playableRight());
  state.players[10].y = clamp(cy + 42, playableTop(), playableBottom());

  state.players[12].x = clamp(cx + 375, playableLeft(), playableRight());
  state.players[12].y = clamp(cy + 82, playableTop(), playableBottom());

  state.players[13].x = clamp(cx + 500, playableLeft(), playableRight());
  state.players[13].y = clamp(cy + 132, playableTop(), playableBottom());

  state.players[15].x = clamp(cx + 605, playableLeft(), playableRight());
  state.players[15].y = clamp(cy + 195, playableTop(), playableBottom());

  state.players[14].x = clamp(cx + 710, playableLeft(), playableRight());
  state.players[14].y = clamp(cy + 245, playableTop(), playableBottom());

  state.players[11].x = clamp(cx + 440, playableLeft(), playableRight());
  state.players[11].y = clamp(cy - 118, playableTop(), playableBottom());

  state.ball.x = cx + 105;
  state.ball.y = cy + 8;

  clampAll();
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

  socket.on("controller-connect", number => {
    number = Number(number);
    controllerSockets[socket.id] = number;

    if (state.players[number]) {
      state.players[number].connected = true;
    }

    emitState();
  });

  socket.on("controller-move", data => {
    if (state.frozen || !data) return;

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

  socket.on("player-join", number => {
    number = Number(number);
    controllerSockets[socket.id] = number;

    if (state.players[number]) {
      state.players[number].connected = true;
    }

    emitState();
  });

  socket.on("join-player", number => {
    number = Number(number);
    controllerSockets[socket.id] = number;

    if (state.players[number]) {
      state.players[number].connected = true;
    }

    emitState();
  });

  socket.on("controller-join", number => {
    number = Number(number);
    controllerSockets[socket.id] = number;

    if (state.players[number]) {
      state.players[number].connected = true;
    }

    emitState();
  });

  socket.on("coach-move-player", data => {
    if (state.frozen || !data) return;

    const player = state.players[Number(data.number)];
    if (!player) return;

    player.x = clamp(Number(data.x), playableLeft(), playableRight());
    player.y = clamp(Number(data.y), playableTop(), playableBottom());

    emitState();
  });

  socket.on("coach-ball", data => {
    if (state.frozen || !data) return;

    state.ball.x = clamp(Number(data.x), playableLeft(), playableRight());
    state.ball.y = clamp(Number(data.y), playableTop(), playableBottom());

    emitState();
  });

  socket.on("coach-attach-ball", number => {
    const player = state.players[Number(number)];
    if (!player) return;

    state.ball.x = clamp(player.x + 28, playableLeft(), playableRight());
    state.ball.y = clamp(player.y - 10, playableTop(), playableBottom());

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

  socket.on("coach-pitch-mode", mode => {
    state.pitchMode = ["full", "half", "lineout"].includes(mode) ? mode : "full";
    clampAll();
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
