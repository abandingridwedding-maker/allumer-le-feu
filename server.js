const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

/* =========================================
   STATIC FILES
========================================= */

app.use(express.static(__dirname));

/* =========================================
   SESSION STORAGE
========================================= */

const sessions = new Map();

/* =========================================
   HELPERS
========================================= */

function createSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createDefaultSession(sessionId) {
  return {
    id: sessionId,

    frozen: false,

    layout: "lineout",

    attackDirection: "right-to-left",

    playerSize: "large",

    teamColor: "red",

    players: {},

    ball: {
      x: 72,
      y: 50,
      holder: null,
      visible: true
    },

    simulator: {
      active: false,
      currentPlay: null,
      isPlaying: false,
      currentTime: 0
    }
  };
}

function getOrCreateSession(sessionId) {
  const id = sessionId || createSessionId();

  if (!sessions.has(id)) {
    sessions.set(id, createDefaultSession(id));
  }

  return sessions.get(id);
}

function publicSession(session) {
  return {
    id: session.id,
    frozen: session.frozen,
    layout: session.layout,
    attackDirection: session.attackDirection,
    playerSize: session.playerSize,
    teamColor: session.teamColor,
    players: session.players,
    ball: session.ball,
    simulator: session.simulator
  };
}

function broadcastSession(session) {
  io.to(session.id).emit("session:update", publicSession(session));
}

/* =========================================
   DEFAULT RUGBY SHAPES
========================================= */

function applyLayout(session, layout) {
  session.layout = layout;

  const rtl = session.attackDirection === "right-to-left";

  let basePlayers = {};

  if (layout === "scrum") {
    basePlayers = {
      1: { x: 72, y: 45 },
      2: { x: 72, y: 50 },
      3: { x: 72, y: 55 },

      4: { x: 76, y: 47 },
      5: { x: 76, y: 53 },

      6: { x: 80, y: 44 },
      7: { x: 80, y: 56 },
      8: { x: 82, y: 50 },

      9: { x: 86, y: 50 },

      10: { x: 66, y: 40 },

      11: { x: 35, y: 15 },
      12: { x: 54, y: 45 },
      13: { x: 46, y: 55 },
      14: { x: 28, y: 85 },
      15: { x: 42, y: 38 }
    };
  } else {
    basePlayers = {
      1: { x: 78, y: 14 },
      2: { x: 78, y: 10 },
      3: { x: 78, y: 18 },

      4: { x: 72, y: 12 },
      5: { x: 68, y: 16 },

      6: { x: 64, y: 20 },
      7: { x: 60, y: 12 },
      8: { x: 56, y: 16 },

      9: { x: 70, y: 25 },

      10: { x: 63, y: 35 },

      11: { x: 43, y: 72 },
      12: { x: 55, y: 45 },
      13: { x: 48, y: 55 },
      14: { x: 32, y: 82 },
      15: { x: 42, y: 36 }
    };
  }

  for (let i = 1; i <= 15; i++) {
    const existing = session.players[i] || {};
    const base = basePlayers[i];

    session.players[i] = {
      id: String(i),
      number: i,
      role: String(i),

      connected: existing.connected || false,

      socketId: existing.socketId || null,

      controllerId: existing.controllerId || null,

      color: session.teamColor,

      x: rtl ? base.x : 100 - base.x,

      y: base.y
    };
  }
}

/* =========================================
   SOCKET.IO
========================================= */

io.on("connection", (socket) => {

  console.log("CONNECTED:", socket.id);

  /* =========================
     CREATE SESSION
  ========================= */

  socket.on("coach:createSession", () => {

    const sessionId = createSessionId();

    const session = getOrCreateSession(sessionId);

    session.coachSocketId = socket.id;

    applyLayout(session, session.layout);

    socket.join(session.id);

    socket.emit(
      "coach:sessionCreated",
      publicSession(session)
    );

    broadcastSession(session);
  });

  /* =========================
     JOIN SESSION
  ========================= */

  socket.on("coach:joinSession", ({ sessionId }) => {

    const session = getOrCreateSession(sessionId);

    session.coachSocketId = socket.id;

    socket.join(session.id);

    socket.emit(
      "coach:sessionJoined",
      publicSession(session)
    );

    broadcastSession(session);
  });

  /* =========================
     PLAYER JOIN
  ========================= */

  socket.on("player:joinSession", (data) => {

    const {
      sessionId,
      playerNumber,
      controllerId
    } = data;

    const session = getOrCreateSession(sessionId);

    socket.join(session.id);

    const number = String(playerNumber);

    if (!session.players[number]) {
      session.players[number] = {
        id: number,
        number: Number(number),
        role: number,
        x: 50,
        y: 50
      };
    }

    session.players[number].connected = true;

    session.players[number].socketId = socket.id;

    session.players[number].controllerId =
      controllerId || socket.id;

    socket.data.sessionId = session.id;

    socket.data.playerNumber = number;

    socket.emit("player:joined", {
      sessionId: session.id,
      playerNumber: number,
      session: publicSession(session)
    });

    broadcastSession(session);
  });

  /* =========================
     LAYOUT
  ========================= */

  socket.on("coach:setLayout", (data) => {

    const session =
      getOrCreateSession(data.sessionId);

    applyLayout(session, data.layout);

    broadcastSession(session);
  });

  /* =========================
     RESET
  ========================= */

  socket.on("coach:reset", (data) => {

    const session =
      getOrCreateSession(data.sessionId);

    applyLayout(session, session.layout);

    broadcastSession(session);
  });

  /* =========================
     FREEZE
  ========================= */

  socket.on("coach:freeze", (data) => {

    const session =
      getOrCreateSession(data.sessionId);

    session.frozen = !!data.frozen;

    broadcastSession(session);
  });

  /* =========================
     ATTACK DIRECTION
  ========================= */

  socket.on("coach:setAttackDirection", (data) => {

    const session =
      getOrCreateSession(data.sessionId);

    session.attackDirection =
      data.attackDirection;

    applyLayout(session, session.layout);

    broadcastSession(session);
  });

  /* =========================
     PLAYER SIZE
  ========================= */

  socket.on("coach:setPlayerSize", (data) => {

    const session =
      getOrCreateSession(data.sessionId);

    session.playerSize = data.playerSize;

    broadcastSession(session);
  });

  /* =========================
     TEAM COLOUR
  ========================= */

  socket.on("coach:setTeamColor", (data) => {

    const session =
      getOrCreateSession(data.sessionId);

    session.teamColor = data.teamColor;

    Object.values(session.players).forEach((p) => {
      p.color = data.teamColor;
    });

    broadcastSession(session);
  });

  /* =========================
     MOVE PLAYER
  ========================= */

  socket.on("coach:movePlayer", (data) => {

    const session =
      getOrCreateSession(data.sessionId);

    if (session.frozen) return;

    const number = String(data.playerNumber);

    if (!session.players[number]) return;

    session.players[number].x =
      clamp(data.x, 0, 100);

    session.players[number].y =
      clamp(data.y, 0, 100);

    broadcastSession(session);
  });

  /* =========================
     MOVE BALL
  ========================= */

  socket.on("coach:moveBall", (data) => {

    const session =
      getOrCreateSession(data.sessionId);

    session.ball = {
      x: clamp(data.x, 0, 100),
      y: clamp(data.y, 0, 100),
      holder: data.holder || null,
      visible: true
    };

    broadcastSession(session);
  });

  /* =========================
     DISCONNECT
  ========================= */

  socket.on("disconnect", () => {

    console.log("DISCONNECTED:", socket.id);

    const {
      sessionId,
      playerNumber
    } = socket.data || {};

    if (!sessionId || !playerNumber) return;

    const session = sessions.get(sessionId);

    if (!session) return;

    const player =
      session.players[playerNumber];

    if (!player) return;

    player.connected = false;

    player.socketId = null;

    broadcastSession(session);
  });
});

/* =========================================
   ROUTES
========================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "clarity.html")
  );
});

/* =========================================
   START SERVER
========================================= */

server.listen(PORT, () => {
  console.log(`
==================================
TEAM-CLARITY V2 RUNNING
PORT: ${PORT}
==================================
`);
});
