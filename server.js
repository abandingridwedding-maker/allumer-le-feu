const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

app.use(express.static(__dirname));

const COLORS = {
  red: "#d71920",
  white: "#ffffff",
  black: "#111111",
  blue: "#1f6feb"
};

function createInitialPlayers() {
  const players = {};

  for (let i = 1; i <= 15; i++) {
    players[i] = {
      number: i,
      x: 250 + (i % 5) * 90,
      y: 180 + Math.floor(i / 5) * 90,
      color: COLORS.red,
      connected: false
    };
  }

  return players;
}

let state = {
  players: createInitialPlayers(),
  ball: { x: 820, y: 430, attachedTo: null },
  frozen: false,
  speed: 5,
  sportMode: "rugby",
  attackDirection: "rtl",
  teamColor: "red"
};

let simulatorState = {
  connectedPlayers: {},
  active: false
};

function emitState() {
  io.emit("state", state);
}

function resetState() {
  state.players = createInitialPlayers();
  state.ball = { x: 820, y: 430, attachedTo: null };
  state.frozen = false;
  emitState();
}

function setAllTeamColors(colorName) {
  const color = COLORS[colorName] || COLORS.red;

  Object.values(state.players).forEach(player => {
    player.color = color;
  });

  state.teamColor = colorName;
  emitState();
}

function movePlayer(number, x, y) {
  const player = state.players[number];
  if (!player) return;

  player.x = x;
  player.y = y;

  if (state.ball.attachedTo === number) {
    state.ball.x = x + 30;
    state.ball.y = y - 20;
  }

  emitState();
}

function moveBall(x, y) {
  state.ball.x = x;
  state.ball.y = y;
  state.ball.attachedTo = null;
  emitState();
}

function setLineout({ side, x, y, direction }) {
  const dir = direction || state.attackDirection;
  const baseX = x || 650;
  const baseY = side === "bottom" ? 650 : 210;
  const spacing = side === "bottom" ? -38 : 38;

  [1, 3, 4, 5, 6, 7, 8].forEach((num, i) => {
    state.players[num].x = baseX;
    state.players[num].y = baseY + i * spacing;
  });

  state.players[2].x = baseX - 80;
  state.players[2].y = baseY - spacing;

  state.players[9].x = baseX + 70;
  state.players[9].y = baseY + spacing * 5;

  if (dir === "rtl") {
    state.players[10].x = baseX - 130;
    state.players[12].x = baseX - 180;
    state.players[13].x = baseX - 250;
    state.players[11].x = baseX - 120;
    state.players[15].x = baseX - 360;
    state.players[14].x = baseX - 470;
  } else {
    state.players[10].x = baseX + 130;
    state.players[12].x = baseX + 180;
    state.players[13].x = baseX + 250;
    state.players[11].x = baseX + 120;
    state.players[15].x = baseX + 360;
    state.players[14].x = baseX + 470;
  }

  state.players[10].y = baseY + spacing * 4;
  state.players[12].y = baseY + spacing * 5;
  state.players[13].y = baseY + spacing * 6;
  state.players[11].y = baseY + spacing * 2;
  state.players[15].y = baseY + spacing * 7;
  state.players[14].y = baseY + spacing * 8;

  state.ball.x = baseX + 40;
  state.ball.y = baseY;
  state.ball.attachedTo = null;

  emitState();
}

function setScrum({ x, y, direction }) {
  const dir = direction || state.attackDirection;
  const baseX = x || 760;
  const baseY = y || 450;
  const sign = dir === "rtl" ? 1 : -1;

  state.players[1].x = baseX - 45; state.players[1].y = baseY;
  state.players[2].x = baseX; state.players[2].y = baseY;
  state.players[3].x = baseX + 45; state.players[3].y = baseY;
  state.players[4].x = baseX - 25; state.players[4].y = baseY + 45;
  state.players[5].x = baseX + 25; state.players[5].y = baseY + 45;
  state.players[6].x = baseX - 70; state.players[6].y = baseY + 85;
  state.players[7].x = baseX + 70; state.players[7].y = baseY + 85;
  state.players[8].x = baseX; state.players[8].y = baseY + 115;

  state.players[9].x = baseX + sign * 130; state.players[9].y = baseY + 80;
  state.players[10].x = baseX + sign * 240; state.players[10].y = baseY + 35;
  state.players[12].x = baseX + sign * 340; state.players[12].y = baseY + 80;
  state.players[13].x = baseX + sign * 460; state.players[13].y = baseY + 135;
  state.players[11].x = baseX + sign * 250; state.players[11].y = baseY - 110;
  state.players[14].x = baseX + sign * 620; state.players[14].y = baseY + 230;
  state.players[15].x = baseX + sign * 520; state.players[15].y = baseY + 180;

  state.ball.x = state.players[9].x + sign * 30;
  state.ball.y = state.players[9].y;
  state.ball.attachedTo = null;

  emitState();
}

app.get("/api/qrs", async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    qrs[i] = await QRCode.toDataURL(`${baseUrl}/controller.html?p=${i}`);
  }

  res.json({ baseUrl, qrs });
});

app.get("/api/sim-qrs", async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const qrs = {};

  for (let i = 1; i <= 15; i++) {
    qrs[i] = await QRCode.toDataURL(`${baseUrl}/simcontroller.html?p=${i}`);
  }

  res.json({ baseUrl, qrs });
});

io.on("connection", socket => {
  socket.emit("state", state);

  socket.on("coach-reset", resetState);

  socket.on("coach-freeze", frozen => {
    state.frozen = frozen;
    emitState();
  });

  socket.on("coach-speed", speed => {
    state.speed = Number(speed);
    emitState();
  });

  socket.on("coach-sport-mode", mode => {
    state.sportMode = mode;
    emitState();
  });

  socket.on("coach-attack-direction", direction => {
    state.attackDirection = direction;
    emitState();
  });

  socket.on("coach-team-color", colorName => {
    setAllTeamColors(colorName);
  });

  socket.on("coach-move-player", data => {
    if (!data) return;
    movePlayer(Number(data.number), Number(data.x), Number(data.y));
  });

  socket.on("coach-ball", data => {
    if (!data) return;
    moveBall(Number(data.x), Number(data.y));
  });

  socket.on("coach-attach-ball", number => {
    number = Number(number);
    const player = state.players[number];
    if (!player) return;

    state.ball.attachedTo = number;
    state.ball.x = player.x + 30;
    state.ball.y = player.y - 20;
    emitState();
  });

  socket.on("coach-setpiece", data => {
    if (!data) return;

    if (data.type === "lineout") {
      setLineout(data);
    }

    if (data.type === "scrum") {
      setScrum(data);
    }
  });

  socket.on("player-join", number => {
    number = Number(number);
    if (state.players[number]) {
      state.players[number].connected = true;
      emitState();
    }
  });

  socket.on("controller-join", number => {
    number = Number(number);
    if (state.players[number]) {
      state.players[number].connected = true;
      emitState();
    }
  });

  socket.on("join-player", number => {
    number = Number(number);
    if (state.players[number]) {
      state.players[number].connected = true;
      emitState();
    }
  });

  socket.on("player-move", data => {
    if (!data) return;

    const number = Number(data.number);
    const player = state.players[number];

    if (!player || state.frozen) return;

    const speed = state.speed || 5;

    if (typeof data.x === "number" && typeof data.y === "number") {
      player.x = data.x;
      player.y = data.y;
    } else {
      player.x += Number(data.dx || 0) * speed;
      player.y += Number(data.dy || 0) * speed;
    }

    if (state.ball.attachedTo === number) {
      state.ball.x = player.x + 30;
      state.ball.y = player.y - 20;
    }

    emitState();
  });

  socket.on("player-disconnect-number", number => {
    number = Number(number);
    if (state.players[number]) {
      state.players[number].connected = false;
      emitState();
    }
  });

  // ================================
  // PLAYER SIMULATOR SOCKETS
  // ================================

  socket.on("sim-player-join", number => {
    number = Number(number);

    simulatorState.connectedPlayers[number] = true;

    io.emit("sim-player-connected", {
      number,
      connected: true
    });
  });

  socket.on("sim-player-move", data => {
    if (!data) return;

    io.emit("sim-player-move", {
      number: Number(data.number),
      dx: Number(data.dx || 0),
      dy: Number(data.dy || 0),
      x: typeof data.x === "number" ? data.x : null,
      y: typeof data.y === "number" ? data.y : null
    });
  });

  socket.on("sim-player-timing", data => {
    if (!data) return;

    io.emit("sim-player-timing", {
      number: Number(data.number)
    });
  });

  socket.on("sim-reset", () => {
    simulatorState.connectedPlayers = {};
    io.emit("sim-reset");
  });

  socket.on("disconnect", () => {
    // Live player disconnect is not forced here because phones can refresh/reconnect.
  });
});

server.listen(PORT, () => {
  console.log(`🔥 TEAM-CLARITY is running on port ${PORT}`);
});
