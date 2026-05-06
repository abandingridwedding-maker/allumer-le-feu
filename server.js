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
  teamColor: "red"
};

let simulatorState = {
  connectedPlayers: {}
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/*
  TEAM-CLARITY V2 RULE:
  Rugby always attacks LEFT → RIGHT.
  Forwards stay ahead / closer to ball.
  Backs sit deeper to the LEFT of the set piece.
  Backs are clamped so they remain visible.
*/

function setLineout({ side, x }) {
  const baseX = clamp(Number(x) || 650, 260, 1260);
  const lineoutY = side === "bottom" ? 675 : 225;
  const spacing = side === "bottom" ? -42 : 42;

  const backsDepth = 170;
  const backsX = clamp(baseX - backsDepth, 120, 1320);

  // Lineout forwards — better spaced, less overlap
  const lineoutPlayers = [1, 3, 4, 5, 6, 7, 8];

  lineoutPlayers.forEach((num, i) => {
    state.players[num].x = baseX;
    state.players[num].y = lineoutY + i * spacing;
  });

  // Hooker
  state.players[2].x = clamp(baseX - 85, 90, 1460);
  state.players[2].y = lineoutY - spacing;

  // 9 ahead / inside
  state.players[9].x = clamp(baseX + 78, 90, 1460);
  state.players[9].y = lineoutY + spacing * 4.3;

  // Backs — always visible, deeper to the left, staggered
  state.players[10].x = backsX;
  state.players[10].y = lineoutY + spacing * 3.1;

  state.players[12].x = clamp(backsX - 95, 100, 1460);
  state.players[12].y = lineoutY + spacing * 4.1;

  state.players[13].x = clamp(backsX - 190, 100, 1460);
  state.players[13].y = lineoutY + spacing * 5.0;

  state.players[11].x = clamp(backsX - 30, 100, 1460);
  state.players[11].y = lineoutY + spacing * 1.6;

  state.players[15].x = clamp(backsX - 300, 100, 1460);
  state.players[15].y = lineoutY + spacing * 6.2;

  state.players[14].x = clamp(backsX - 410, 100, 1460);
  state.players[14].y = lineoutY + spacing * 7.1;

  state.ball.x = clamp(baseX + 45, 90, 1500);
  state.ball.y = lineoutY;
  state.ball.attachedTo = null;

  emitState();
}

function setScrum({ x, y }) {
  const baseX = clamp(Number(x) || 720, 350, 1180);
  const baseY = clamp(Number(y) || 450, 220, 660);

  // Scrum pack — wider and clearer
  state.players[1].x = baseX - 55; state.players[1].y = baseY;
  state.players[2].x = baseX;      state.players[2].y = baseY;
  state.players[3].x = baseX + 55; state.players[3].y = baseY;

  state.players[4].x = baseX - 35; state.players[4].y = baseY + 55;
  state.players[5].x = baseX + 35; state.players[5].y = baseY + 55;

  state.players[6].x = baseX - 90; state.players[6].y = baseY + 105;
  state.players[7].x = baseX + 90; state.players[7].y = baseY + 105;

  state.players[8].x = baseX;      state.players[8].y = baseY + 135;

  // Ball / 9 / backline, always left → right attack
  state.players[9].x = clamp(baseX + 150, 90, 1500);
  state.players[9].y = baseY + 95;

  state.players[10].x = clamp(baseX + 260, 90, 1500);
  state.players[10].y = baseY + 45;

  state.players[12].x = clamp(baseX + 370, 90, 1500);
  state.players[12].y = baseY + 88;

  state.players[13].x = clamp(baseX + 495, 90, 1500);
  state.players[13].y = baseY + 140;

  state.players[11].x = clamp(baseX + 250, 90, 1500);
  state.players[11].y = baseY - 125;

  state.players[15].x = clamp(baseX + 560, 90, 1500);
  state.players[15].y = baseY + 195;

  state.players[14].x = clamp(baseX + 680, 90, 1500);
  state.players[14].y = baseY + 245;

  state.ball.x = clamp(state.players[9].x + 35, 90, 1500);
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

    player.x = clamp(player.x, 40, 1560);
    player.y = clamp(player.y, 70, 830);

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

  // PLAYER SIMULATOR SOCKETS
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
      dy: Number(data.dy || 0)
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
});

server.listen(PORT, () => {
  console.log(`🔥 TEAM-CLARITY is running on port ${PORT}`);
});
