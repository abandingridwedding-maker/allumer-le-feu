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

function clampAll() {
  Object.values(state.players).forEach(player => {
    player.x = clamp(player.x, playableLeft(), playableRight());
    player.y = clamp(player.y, playableTop(), playableBottom());
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

function placeLineout(side = "top", clickedX = 920) {
  const isTop = side === "top";

  const x5m = 185;
  const x15m = 395;

  const lineoutX = clamp(
    Number(clickedX) || 300,
    x5m + 45,
    x15m - 45
  );

  const startY = isTop ? 170 : 730;
  const direction = isTop ? 1 : -1;

  const players = state.players;

  players[2].x = lineoutX - 28;
  players[2].y = startY - 6 * direction;

  players[1].x = lineoutX;
  players[1].y = startY + 42 * direction;

  players[3].x = lineoutX - 38;
  players[3].y = startY + 34 * direction;

  players[4].x = lineoutX + 38;
  players[4].y = startY + 74 * direction;

  players[5].x = lineoutX;
  players[5].y = startY + 86 * direction;

  players[6].x = lineoutX + 42;
  players[6].y = startY + 128 * direction;

  players[7].x = lineoutX - 34;
  players[7].y = startY + 122 * direction;

  players[8].x = lineoutX + 42;
  players[8].y = startY + 168 * direction;

  players[9].x = lineoutX + 88;
  players[9].y = startY + 118 * direction;

  players[10].x = lineoutX + 260;
  players[10].y = startY + 185 * direction;

  players[12].x = lineoutX + 390;
  players[12].y = startY + 255 * direction;

  players[13].x = lineoutX + 510;
  players[13].y = startY + 345 * direction;

  players[15].x = lineoutX + 620;
  players[15].y = startY + 440 * direction;

  players[14].x = lineoutX + 720;
  players[14].y = startY + 520 * direction;

  players[11].x = lineoutX + 455;
  players[11].y = startY + 58 * direction;

  state.ball.x = lineoutX + 115;
  state.ball.y = startY + 100 * direction;

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

  state.ball.x = cx + 105;
  state.ball.y = cy + 8;

  clampAll();
}

initPlayers();

function getBaseUrl(req) {
  return process.env.RENDER_EXTERNAL_URL ||
    `https://${req.get("host")}`;
}

app.get("/api/qrs", async (req, res) => {
  const baseUrl = getBaseUrl(req);

  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    qrs[i] = await QRCode.toDataURL(
      `${baseUrl}/controller.html?p=${i}`
    );
  }

  res.json({ baseUrl, qrs });
});

app.get("/api/sim-qrs", async (req, res) => {
  const baseUrl = getBaseUrl(req);

  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    qrs[i] = await QRCode.toDataURL(
      `${baseUrl}/simcontroller.html?p=${i}`
    );
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

    socket.emit("live-controller-ack", {
      number
    });

    emitState();
  }

  socket.on("controller-connect", connectPlayer);
  socket.on("controller-join", connectPlayer);
  socket.on("player-join", connectPlayer);
  socket.on("join-player", connectPlayer);

  socket.on("controller-move", data => {

    if (state.frozen || !data) return;

    const number = Number(
      data.number ||
      controllerSockets[socket.id]
    );

    const player = state.players[number];

    if (!player) return;

    const speed = Number(state.speed || 1);

    const step = 6.5 * speed;

    player.x += Number(data.dx || 0) * step;
    player.y += Number(data.dy || 0) * step;

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

  socket.on("coach-move-player", data => {

    if (!data) return;

    const player = state.players[
      Number(data.number)
    ];

    if (!player) return;

    player.x = clamp(
      Number(data.x),
      playableLeft(),
      playableRight()
    );

    player.y = clamp(
      Number(data.y),
      playableTop(),
      playableBottom()
    );

    emitState();
  });

  socket.on("coach-ball", data => {

    if (!data) return;

    state.ball.x = clamp(
      Number(data.x),
      playableLeft(),
      playableRight()
    );

    state.ball.y = clamp(
      Number(data.y),
      playableTop(),
      playableBottom()
    );

    emitState();
  });

  socket.on("coach-attach-ball", number => {

    const player = state.players[
      Number(number)
    ];

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
      placeLineout(
        data.side || "top",
        data.x || 920
      );
    }

    if (data.type === "scrum") {
      placeScrum(
        data.x || 720,
        data.y || 445
      );
    }

    emitState();
  });

  socket.on("sim-player-join", number => {

    number = Number(number);

    simulatorSockets[socket.id] = number;

    socket.emit("sim-controller-ack", {
      number
    });

    io.emit("sim-player-connected", {
      number,
      connected: true
    });
  });

  socket.on("sim-player-move", data => {

    if (!data) return;

    io.emit("sim-player-move", {
      number: Number(
        data.number ||
        simulatorSockets[socket.id]
      ),
      dx: Number(data.dx || 0),
      dy: Number(data.dy || 0)
    });
  });

  socket.on("disconnect", () => {

    const number =
      controllerSockets[socket.id];

    if (
      number &&
      state.players[number]
    ) {
      state.players[number].connected = false;
      emitState();
    }

    delete controllerSockets[socket.id];
    delete simulatorSockets[socket.id];
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(
    "🔥 TEAM-CLARITY running on port",
    PORT
  );
});
```
