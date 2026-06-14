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

// ---- Per-room live state -------------------------------------------------
// Each Clarity Live session is isolated in its own room, keyed by a short
// code shown on the coach's screen. rooms[code] holds that session's own
// board (its own 15 players + ball + flags). Teams never share a board.
const rooms = {};

function createRoomState() {
  return {
    sportMode: "rugby",
    pitchMode: "full",
    frozen: false,
    speed: 1,
    ball: { x: 950, y: 230 },
    players: {}
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function playableLeft() { return FIELD.left + 18; }
function playableRight() { return FIELD.right - 18; }
function playableTop() { return FIELD.top + 18; }
function playableBottom() { return FIELD.bottom - 18; }

function clampPlayer(player) {
  if (!player) return;
  player.x = clamp(player.x, playableLeft(), playableRight());
  player.y = clamp(player.y, playableTop(), playableBottom());
}

function clampBall(st) {
  st.ball.x = clamp(st.ball.x, playableLeft(), playableRight());
  st.ball.y = clamp(st.ball.y, playableTop(), playableBottom());
}

function clampAll(st) {
  Object.values(st.players).forEach(clampPlayer);
  clampBall(st);
}

function initPlayers(st) {
  st.players = {};

  for (let i = 1; i <= 15; i++) {
    st.players[i] = {
      number: i,
      x: 500,
      y: 300,
      color: COLORS.red,
      connected: false
    };
  }

  placeLineout(st, "top", 920);
}

function placeLineout(st, side, x) {
  const players = st.players;
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

  st.ball.x = xForwards - 55;
  st.ball.y = baseY + 315 * dir;

  clampAll(st);
}

function placeScrum(st, x, y) {
  const players = st.players;
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

  st.ball.x = cx + 70;
  st.ball.y = cy - 10 * dir;

  clampAll(st);
}

function ensureRoom(code) {
  if (!code) return null;
  if (!rooms[code]) {
    const st = createRoomState();
    initPlayers(st);
    rooms[code] = st;
  }
  return rooms[code];
}

function emitRoomState(code) {
  if (rooms[code]) io.to(code).emit("state", rooms[code]);
}

// ---- Simulator state (UNCHANGED — still global; rooms come in pass 2) ----
const simulatorSockets = {};

// ---- QR endpoints --------------------------------------------------------
function getBaseUrl(req) {
  return process.env.RENDER_EXTERNAL_URL || `https://${req.get("host")}`;
}

app.get("/api/qrs", async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const room = (req.query.room || "").toString().trim();
  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    const suffix = room ? `&room=${encodeURIComponent(room)}` : "";
    qrs[i] = await QRCode.toDataURL(`${baseUrl}/controller.html?p=${i}${suffix}`);
  }

  res.json({ baseUrl, room, qrs });
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

  // --- Clarity Live: join a room -----------------------------------------
  // The coach's Live screen joins with its session code; each player phone
  // joins the same code via the QR link. Every handler below is scoped to
  // that room, so teams never see or move each other's players.

  socket.on("coach-join", code => {
    code = (code || "").toString().trim();
    if (!code) return;

    socket.data.room = code;
    socket.data.role = "coach";
    socket.join(code);

    ensureRoom(code);
    socket.emit("state", rooms[code]);
  });

  function connectPlayer(payload) {
    // payload is { number, room } from the controller; fall back gracefully
    let number, code;

    if (payload && typeof payload === "object") {
      number = Number(payload.number);
      code = (payload.room || "").toString().trim();
    } else {
      number = Number(payload);
      code = socket.data.room;
    }

    if (!code || !number) return;

    socket.data.room = code;
    socket.data.role = "controller";
    socket.data.playerNumber = number;
    socket.join(code);

    const st = ensureRoom(code);
    if (!st.players[number]) return;

    st.players[number].connected = true;

    socket.emit("live-controller-ack", { number });
    emitRoomState(code);
  }

  socket.on("controller-connect", connectPlayer);
  socket.on("controller-join", connectPlayer);
  socket.on("player-join", connectPlayer);
  socket.on("join-player", connectPlayer);

  socket.on("controller-move", data => {
    const code = socket.data.room;
    const st = rooms[code];
    if (!st || st.frozen || !data) return;

    const number = Number(data.number || socket.data.playerNumber);
    const player = st.players[number];
    if (!player) return;

    const speed = Number(st.speed || 1);
    const step = 6.5 * speed;

    player.x += Number(data.dx || 0) * step;
    player.y += Number(data.dy || 0) * step;

    clampPlayer(player);
    emitRoomState(code);
  });

  socket.on("coach-move-player", data => {
    const st = rooms[socket.data.room];
    if (!st || !data) return;

    const player = st.players[Number(data.number)];
    if (!player) return;

    player.x = clamp(Number(data.x), playableLeft(), playableRight());
    player.y = clamp(Number(data.y), playableTop(), playableBottom());

    emitRoomState(socket.data.room);
  });

  socket.on("coach-ball", data => {
    const st = rooms[socket.data.room];
    if (!st || !data) return;

    st.ball.x = clamp(Number(data.x), playableLeft(), playableRight());
    st.ball.y = clamp(Number(data.y), playableTop(), playableBottom());

    emitRoomState(socket.data.room);
  });

  socket.on("coach-full-state", data => {
    const st = rooms[socket.data.room];
    if (!st || !data) return;

    if (data.players) {
      Object.keys(data.players).forEach(number => {
        if (!st.players[number]) return;

        st.players[number].x = clamp(
          Number(data.players[number].x),
          playableLeft(),
          playableRight()
        );

        st.players[number].y = clamp(
          Number(data.players[number].y),
          playableTop(),
          playableBottom()
        );
      });
    }

    if (data.ball) {
      st.ball.x = clamp(Number(data.ball.x), playableLeft(), playableRight());
      st.ball.y = clamp(Number(data.ball.y), playableTop(), playableBottom());
    }

    emitRoomState(socket.data.room);
  });

  socket.on("coach-attach-ball", number => {
    const st = rooms[socket.data.room];
    if (!st) return;

    const player = st.players[Number(number)];
    if (!player) return;

    st.ball.x = player.x + 28;
    st.ball.y = player.y - 10;

    clampAll(st);
    emitRoomState(socket.data.room);
  });

  socket.on("coach-reset", () => {
    const st = rooms[socket.data.room];
    if (!st) return;
    placeLineout(st, "top", 920);
    emitRoomState(socket.data.room);
  });

  socket.on("coach-freeze", frozen => {
    const st = rooms[socket.data.room];
    if (!st) return;
    st.frozen = Boolean(frozen);
    emitRoomState(socket.data.room);
  });

  socket.on("coach-speed", speed => {
    const st = rooms[socket.data.room];
    if (!st) return;
    st.speed = Number(speed || 1);
    emitRoomState(socket.data.room);
  });

  socket.on("coach-pitch-mode", mode => {
    const st = rooms[socket.data.room];
    if (!st) return;
    st.pitchMode = mode || "full";
  });

  socket.on("coach-sport-mode", mode => {
    const st = rooms[socket.data.room];
    if (!st) return;
    st.sportMode = mode || "rugby";
    emitRoomState(socket.data.room);
  });

  socket.on("coach-setpiece", data => {
    const st = rooms[socket.data.room];
    if (!st || !data) return;

    if (data.type === "lineout") {
      placeLineout(st, data.side || "top", data.x || 920);
    }

    if (data.type === "scrum") {
      placeScrum(st, data.x || 720, data.y || 445);
    }

    emitRoomState(socket.data.room);
  });

  // --- Simulator (UNCHANGED — global for now; pass 2 will room-scope it) --
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

  // --- Cleanup -----------------------------------------------------------
  socket.on("disconnect", () => {
    const code = socket.data.room;
    const number = socket.data.playerNumber;

    if (code && rooms[code] && number && rooms[code].players[number]) {
      rooms[code].players[number].connected = false;
      emitRoomState(code);
    }

    // Drop empty rooms so memory doesn't grow as sessions end
    if (code) {
      const r = io.sockets.adapter.rooms.get(code);
      if (!r || r.size === 0) delete rooms[code];
    }

    delete simulatorSockets[socket.id];
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🔥 TEAM-CLARITY running on port", PORT);
});