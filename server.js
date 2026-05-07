const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const sessions = new Map();

function createSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createDefaultSession(sessionId) {
  return {
    id: sessionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    coachSocketId: null,
    frozen: false,
    mode: "rugby",
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
      currentTime: 0,
      isPlaying: false,
      score: null
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
    mode: session.mode,
    layout: session.layout,
    attackDirection: session.attackDirection,
    playerSize: session.playerSize,
    teamColor: session.teamColor,
    players: session.players,
    ball: session.ball,
    simulator: session.simulator
  };
}

function updateSession(session) {
  session.updatedAt = Date.now();
  io.to(session.id).emit("session:update", publicSession(session));
}

function applyLayout(session, layout) {
  session.layout = layout;

  const rightToLeft = session.attackDirection === "right-to-left";

  const lineoutPlayers = {
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

  const scrumPlayers = {
    1: { x: 72, y: 45 },
    2: { x: 72, y: 50 },
    3: { x: 72, y: 55 },
    4: { x: 76, y: 47 },
    5: { x: 76, y: 53 },
    6: { x: 80, y: 44 },
    7: { x: 80, y: 56 },
    8: { x: 82, y: 50 },
    9: { x: 86, y: 50 },
    10: { x: 67, y: 42 },
    11: { x: 38, y: 18 },
    12: { x: 58, y: 48 },
    13: { x: 49, y: 55 },
    14: { x: 30, y: 82 },
    15: { x: 43, y: 38 }
  };

  const shape = layout === "scrum" ? scrumPlayers : lineoutPlayers;

  for (let i = 1; i <= 15; i++) {
    const existing = session.players[i] || {};
    const base = shape[i];

    session.players[i] = {
      id: String(i),
      number: i,
      role: String(i),
      connected: existing.connected || false,
      socketId: existing.socketId || null,
      controllerId: existing.controllerId || null,
      color: existing.color || session.teamColor,
      x: rightToLeft ? base.x : 100 - base.x,
      y: base.y
    };
  }

  session.ball = {
    x: rightToLeft ? 76 : 24,
    y: layout === "scrum" ? 50 : 14,
    holder: layout === "scrum" ? "9" : "2",
    visible: true
  };
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("coach:createSession", () => {
    const sessionId = createSessionId();
    const session = getOrCreateSession(sessionId);

    session.coachSocketId = socket.id;
    applyLayout(session, session.layout);

    socket.join(sessionId);

    socket.emit("coach:sessionCreated", publicSession(session));
    updateSession(session);
  });

  socket.on("coach:joinSession", ({ sessionId }) => {
    const session = getOrCreateSession(sessionId);

    session.coachSocketId = socket.id;
    socket.join(session.id);

    socket.emit("coach:sessionJoined", publicSession(session));
    updateSession(session);
  });

  socket.on("player:joinSession", ({ sessionId, playerNumber, controllerId }) => {
    const session = getOrCreateSession(sessionId);
    const number = String(playerNumber);

    socket.join(session.id);

    if (!session.players[number]) {
      session.players[number] = {
        id: number,
        number: Number(number),
        role: number,
        x: 50,
        y: 50,
        color: session.teamColor
      };
    }

    session.players[number] = {
      ...session.players[number],
      connected: true,
      socketId: socket.id,
      controllerId: controllerId || socket.id
    };

    socket.data.sessionId = session.id;
    socket.data.playerNumber = number;
    socket.data.controllerId = controllerId || socket.id;

    socket.emit("player:joined", {
      sessionId: session.id,
      playerNumber: number,
      session: publicSession(session)
    });

    updateSession(session);
  });

  socket.on("coach:setLayout", ({ sessionId, layout }) => {
    const session = getOrCreateSession(sessionId);
    applyLayout(session, layout);
    updateSession(session);
  });

  socket.on("coach:reset", ({ sessionId }) => {
    const session = getOrCreateSession(sessionId);
    applyLayout(session, session.layout);
    updateSession(session);
  });

  socket.on("coach:setAttackDirection", ({ sessionId, attackDirection }) => {
    const session = getOrCreateSession(sessionId);
    session.attackDirection = attackDirection || "right-to-left";
    applyLayout(session, session.layout);
    updateSession(session);
  });

  socket.on("coach:setPlayerSize", ({ sessionId, playerSize }) => {
    const session = getOrCreateSession(sessionId);
    session.playerSize = playerSize || "large";
    updateSession(session);
  });

  socket.on("coach:setTeamColor", ({ sessionId, teamColor }) => {
    const session = getOrCreateSession(sessionId);
    session.teamColor = teamColor || "red";

    Object.keys(session.players).forEach((id) => {
      session.players[id].color = session.teamColor;
    });

    updateSession(session);
  });

  socket.on("coach:freeze", ({ sessionId, frozen }) => {
    const session = getOrCreateSession(sessionId);
    session.frozen = !!frozen;
    updateSession(session);
  });

  socket.on("coach:movePlayer", ({ sessionId, playerNumber, x, y }) => {
    const session = getOrCreateSession(sessionId);
    const number = String(playerNumber);

    if (session.frozen) return;

    if (!session.players[number]) return;

    session.players[number].x = clamp(Number(x), 0, 100);
    session.players[number].y = clamp(Number(y), 0, 100);

    updateSession(session);
  });

  socket.on("player:move", ({ sessionId, playerNumber, x, y }) => {
    const session = getOrCreateSession(sessionId);
    const number = String(playerNumber);

    if (session.frozen) return;
    if (!session.players[number]) return;

    session.players[number].x = clamp(Number(x), 0, 100);
    session.players[number].y = clamp(Number(y), 0, 100);

    updateSession(session);
  });

  socket.on("coach:moveBall", ({ sessionId, x, y, holder }) => {
    const session = getOrCreateSession(sessionId);

    session.ball = {
      x: clamp(Number(x), 0, 100),
      y: clamp(Number(y), 0, 100),
      holder: holder || null,
      visible: true
    };

    updateSession(session);
  });

  socket.on("simulator:loadPlay", ({ sessionId, play }) => {
    const session = getOrCreateSession(sessionId);

    session.simulator.active = true;
    session.simulator.currentPlay = play;
    session.simulator.currentTime = 0;
    session.simulator.isPlaying = false;
    session.simulator.score = null;

    io.to(session.id).emit("simulator:loadPlay", play);
    updateSession(session);
  });

  socket.on("simulator:start", ({ sessionId, playId }) => {
    const session = getOrCreateSession(sessionId);

    session.simulator.active = true;
    session.simulator.isPlaying = true;

    io.to(session.id).emit("simulator:start", { playId });
    updateSession(session);
  });

  socket.on("simulator:pause", ({ sessionId }) => {
    const session = getOrCreateSession(sessionId);

    session.simulator.isPlaying = false;

    io.to(session.id).emit("simulator:pause", {});
    updateSession(session);
  });

  socket.on("simulator:resume", ({ sessionId }) => {
    const session = getOrCreateSession(sessionId);

    session.simulator.isPlaying = true;

    io.to(session.id).emit("simulator:resume", {});
    updateSession(session);
  });

  socket.on("simulator:reset", ({ sessionId }) => {
    const session = getOrCreateSession(sessionId);

    session.simulator.currentTime = 0;
    session.simulator.isPlaying = false;
    session.simulator.score = null;

    io.to(session.id).emit("simulator:reset", {});
    updateSession(session);
  });

  socket.on("simulator:finish", ({ sessionId, score, positionScore, timingScore }) => {
    const session = getOrCreateSession(sessionId);

    session.simulator.isPlaying = false;
    session.simulator.score = {
      total: score,
      position: positionScore,
      timing: timingScore
    };

    updateSession(session);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    const { sessionId, playerNumber } = socket.data || {};
    if (!sessionId || !playerNumber) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    const player = session.players[String(playerNumber)];
    if (!player) return;

    player.connected = false;
    player.socketId = null;

    updateSession(session);
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", sessions: sessions.size });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "clarity.html"));
});

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

server.listen(PORT, () => {
  console.log(`TEAM-CLARITY V2 running on port ${PORT}`);
});
