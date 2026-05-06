const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.static(__dirname));

/* =========================================
   GLOBAL STATE
========================================= */

const FIELD = {
  width: 1600,
  height: 900,

  topMargin: 120,
  bottomMargin: 140,
  sideMargin: 70
};

const state = {
  sportMode: "rugby",
  frozen: false,
  speed: 1,

  ball: {
    x: 900,
    y: 450
  },

  players: {}
};

const controllerSockets = {};

/* =========================================
   INIT PLAYERS
========================================= */

function initPlayers() {
  state.players = {};

  for (let i = 1; i <= 15; i++) {
    state.players[i] = {
      number: i,
      x: 500,
      y: 300,
      color: "#d71920",
      connected: false
    };
  }

  applyLineoutTop();
}

initPlayers();

/* =========================================
   HELPERS
========================================= */

function emitState() {
  io.emit("state", state);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function playableTop() {
  return FIELD.topMargin;
}

function playableBottom() {
  return FIELD.height - FIELD.bottomMargin;
}

function playableLeft() {
  return FIELD.sideMargin;
}

function playableRight() {
  return FIELD.width - FIELD.sideMargin;
}

/* =========================================
   RUGBY SHAPES
========================================= */

/*
ALWAYS RIGHT -> LEFT

Forwards:
RIGHT SIDE

Backs:
LEFT SIDE behind them
*/

function applyLineoutTop() {

  const xForwards = 920;
  const xBacks = 760;

  const startY = 180;
  const spacing = 48;

  // forwards between 5m and 15m
  const forwards = [2,3,4,5,6,7,8];

  forwards.forEach((n, i) => {
    state.players[n].x = xForwards;
    state.players[n].y = startY + (i * spacing);
  });

  // hooker
  state.players[2].x = xForwards - 80;
  state.players[2].y = startY - 10;

  // 9
  state.players[9].x = xForwards + 70;
  state.players[9].y = startY + 240;

  // backs
  state.players[10].x = xBacks + 20;
  state.players[10].y = 500;

  state.players[12].x = xBacks - 40;
  state.players[12].y = 560;

  state.players[13].x = xBacks - 110;
  state.players[13].y = 620;

  state.players[15].x = xBacks - 180;
  state.players[15].y = 690;

  state.players[14].x = xBacks - 250;
  state.players[14].y = 760;

  state.players[11].x = xForwards - 40;
  state.players[11].y = 360;

  // ball
  state.ball.x = xForwards + 28;
  state.ball.y = startY + 45;
}

function applyLineoutBottom() {

  const xForwards = 920;
  const xBacks = 760;

  const startY = 720;
  const spacing = -48;

  const forwards = [2,3,4,5,6,7,8];

  forwards.forEach((n, i) => {
    state.players[n].x = xForwards;
    state.players[n].y = startY + (i * spacing);
  });

  state.players[2].x = xForwards - 80;
  state.players[2].y = startY + 10;

  state.players[9].x = xForwards + 70;
  state.players[9].y = startY - 240;

  state.players[10].x = xBacks + 20;
  state.players[10].y = 420;

  state.players[12].x = xBacks - 40;
  state.players[12].y = 480;

  state.players[13].x = xBacks - 110;
  state.players[13].y = 540;

  state.players[15].x = xBacks - 180;
  state.players[15].y = 610;

  state.players[14].x = xBacks - 250;
  state.players[14].y = 680;

  state.players[11].x = xForwards - 40;
  state.players[11].y = 260;

  state.ball.x = xForwards + 28;
  state.ball.y = startY - 45;
}

function applyScrum() {

  const cx = 700;
  const cy = 470;

  const gap = 42;

  // FRONT ROW
  state.players[1].x = cx - gap;
  state.players[1].y = cy - gap;

  state.players[2].x = cx;
  state.players[2].y = cy - gap;

  state.players[3].x = cx + gap;
  state.players[3].y = cy - gap;

  // SECOND ROW
  state.players[4].x = cx - 20;
  state.players[4].y = cy;

  state.players[5].x = cx + 20;
  state.players[5].y = cy;

  // BACK ROW
  state.players[6].x = cx - 70;
  state.players[6].y = cy + gap;

  state.players[7].x = cx + 70;
  state.players[7].y = cy + gap;

  state.players[8].x = cx;
  state.players[8].y = cy + gap + 18;

  // 9 always right side
  state.players[9].x = cx + 165;
  state.players[9].y = cy + 18;

  // backs left side
  state.players[10].x = 970;
  state.players[10].y = 500;

  state.players[12].x = 1030;
  state.players[12].y = 560;

  state.players[13].x = 1150;
  state.players[13].y = 620;

  state.players[15].x = 1220;
  state.players[15].y = 690;

  state.players[14].x = 1320;
  state.players[14].y = 760;

  state.players[11].x = 1120;
  state.players[11].y = 360;

  state.ball.x = cx + 105;
  state.ball.y = cy + 10;
}

/* =========================================
   SOCKETS
========================================= */

io.on("connection", socket => {

  /* =========================
     SEND STATE
  ========================= */

  socket.emit("state", state);

  /* =========================
     CONTROLLER CONNECT
  ========================= */

  socket.on("controller-connect", number => {

    number = Number(number);

    controllerSockets[socket.id] = number;

    if (state.players[number]) {
      state.players[number].connected = true;
    }

    emitState();
  });

  /* =========================
     CONTROLLER MOVE
  ========================= */

  socket.on("controller-move", data => {

    if (state.frozen) return;

    const number = controllerSockets[socket.id];

    if (!number) return;

    const player = state.players[number];

    if (!player) return;

    player.x += data.dx * 7;
    player.y += data.dy * 7;

    player.x = clamp(
      player.x,
      playableLeft(),
      playableRight()
    );

    player.y = clamp(
      player.y,
      playableTop(),
      playableBottom()
    );

    emitState();
  });

  /* =========================
     COACH MOVE PLAYER
  ========================= */

  socket.on("coach-move-player", data => {

    if (state.frozen) return;

    const p = state.players[data.number];

    if (!p) return;

    p.x = clamp(data.x, playableLeft(), playableRight());
    p.y = clamp(data.y, playableTop(), playableBottom());

    emitState();
  });

  /* =========================
     BALL
  ========================= */

  socket.on("coach-ball", data => {

    if (state.frozen) return;

    state.ball.x = clamp(
      data.x,
      playableLeft(),
      playableRight()
    );

    state.ball.y = clamp(
      data.y,
      playableTop(),
      playableBottom()
    );

    emitState();
  });

  /* =========================
     ATTACH BALL
  ========================= */

  socket.on("coach-attach-ball", number => {

    const p = state.players[number];

    if (!p) return;

    state.ball.x = p.x + 28;
    state.ball.y = p.y - 10;

    emitState();
  });

  /* =========================
     RESET
  ========================= */

  socket.on("coach-reset", () => {

    applyLineoutTop();
    emitState();
  });

  /* =========================
     FREEZE
  ========================= */

  socket.on("coach-freeze", frozen => {

    state.frozen = frozen;
    emitState();
  });

  /* =========================
     SPEED
  ========================= */

  socket.on("coach-speed", speed => {

    state.speed = Number(speed);
    emitState();
  });

  /* =========================
     COLOR
  ========================= */

  socket.on("coach-team-color", color => {

    Object.values(state.players).forEach(p => {
      p.color = color;
    });

    emitState();
  });

  /* =========================
     SPORT
  ========================= */

  socket.on("coach-sport-mode", mode => {

    state.sportMode = mode;
    emitState();
  });

  /* =========================
     SETPIECE
  ========================= */

  socket.on("coach-setpiece", data => {

    if (data.type === "lineout") {

      if (data.side === "top") {
        applyLineoutTop();
      } else {
        applyLineoutBottom();
      }
    }

    if (data.type === "scrum") {
      applyScrum();
    }

    emitState();
  });

  /* =========================
     DISCONNECT
  ========================= */

  socket.on("disconnect", () => {

    const number = controllerSockets[socket.id];

    if (number && state.players[number]) {
      state.players[number].connected = false;
    }

    delete controllerSockets[socket.id];

    emitState();
  });
});

/* =========================================
   QR API
========================================= */

app.get("/api/qrs", async (req, res) => {

  const baseUrl =
    process.env.RENDER_EXTERNAL_URL ||
    `https://${req.get("host")}`;

  const qrs = {};

  for (let i = 1; i <= 15; i++) {

    const url = `${baseUrl}/controller.html?p=${i}`;

    qrs[i] = await QRCode.toDataURL(url);
  }

  res.json({
    baseUrl,
    qrs
  });
});

/* =========================================
   START
========================================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("TEAM-CLARITY running on port", PORT);
});
