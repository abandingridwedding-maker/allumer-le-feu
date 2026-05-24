const socket = io();

const tcBallImg = new Image();
tcBallImg.src = "assets/tc-ball.png";

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

const W = canvas.width;
const H = canvas.height;

const rugbyPitchImg = new Image();
rugbyPitchImg.src = "assets/rugby-pitch.png";
rugbyPitchImg.onload = () => draw();

const halfPitchImg = new Image();
halfPitchImg.src = "assets/half-pitch.png";
halfPitchImg.onload = () => draw();

const lineoutPitchImg = new Image();
lineoutPitchImg.src = "assets/lineout-pitch.png";
lineoutPitchImg.onload = () => draw();

let setupMode = "free";
let playerGroup = "all";
let playerSize = "small";
let sportMode = "rugby";
let pitchMode = "full";
let currentLang = "en";
let setPieceCycle = 0;

let draggingBall = false;
let draggingPlayerNumber = null;
let dragOffset = { x: 0, y: 0 };

const COLORS = {
  red: "#d71920",
  white: "#ffffff",
  black: "#111111",
  blue: "#1f6feb"
};

const FIELD = {
  left: 35,
  right: W - 35,
  top: 72,
  bottom: H - 82
};

function getPitchField() {
  return {
    left: 35,
    right: W - 35,
    top: 72,
    bottom: H - 82
  };
}

function applyActiveField() {
  Object.assign(FIELD, getPitchField());
}

function playerClampPadding() {
  if (playerSize === "small") return { x: 18, y: 18 };
  if (playerSize === "medium") return { x: 24, y: 34 };
  return { x: 34, y: 48 };
}

function ballClampPadding() {
  return { x: 24, y: 24 };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clampPointToField(point, isBall = false) {
  const pad = isBall ? ballClampPadding() : playerClampPadding();

  return {
    x: clamp(point.x, FIELD.left + pad.x, FIELD.right - pad.x),
    y: clamp(point.y, FIELD.top + pad.y, FIELD.bottom - pad.y)
  };
}

function clampPlayer(player) {
  const p = clampPointToField(player, false);
  player.x = p.x;
  player.y = p.y;
}

function clampBall(ball) {
  const p = clampPointToField(ball, true);
  ball.x = p.x;
  ball.y = p.y;
}

function createDefaultPlayers() {
  const players = {};

  for (let i = 1; i <= 15; i++) {
    players[i] = {
      number: i,
      x: 500,
      y: 300,
      color: COLORS.red,
      connected: false
    };
  }

  return players;
}

function placeDefaultLineout(players, ball) {
  const xForwards = 920;
  const startY = 165;
  const spacing = 34;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    players[n].x = xForwards;
    players[n].y = startY + i * spacing;
  });

  players[2].x = xForwards - 78;
  players[2].y = startY;

  players[9].x = xForwards + 76;
  players[9].y = startY + spacing * 4.2;

  players[10].x = xForwards + 185;
  players[10].y = startY + spacing * 3.5;

  players[12].x = xForwards + 290;
  players[12].y = startY + spacing * 4.3;

  players[13].x = xForwards + 405;
  players[13].y = startY + spacing * 5;

  players[15].x = xForwards + 515;
  players[15].y = startY + spacing * 5.9;

  players[14].x = xForwards + 620;
  players[14].y = startY + spacing * 6.8;

  players[11].x = xForwards + 345;
  players[11].y = startY + spacing * 1.6;

  ball.x = xForwards + 34;
  ball.y = startY + spacing * 1.4;

  Object.values(players).forEach(clampPlayer);
  clampBall(ball);
}

let state = {
  players: createDefaultPlayers(),
  ball: { x: 950, y: 230 },
  frozen: false,
  sportMode: "rugby",
  pitchMode: "full"
};

placeDefaultLineout(state.players, state.ball);

const TEXT = {
  en: {
    qrCodes: "QR Codes",
    qrTitle: "Scan to control players",
    close: "Close",
    freeze: "Freeze",
    reset: "Reset",
    speed: "Speed",
    freeBallMode: "LIVE MODE",
    attack: "ATTACK: RIGHT → LEFT",
    footer: "Drag players or ball | Double-click player = attach ball",
    session: "SESSION LIVE 🔴",
    message1: "Your session is connected.",
    message2: "To keep players connected and continue managing your team:",
    price: "€9.99 / year",
    unlock: "Unlock Access",
    promo: "Promo code:",
    promoPlaceholder: "Enter code",
    applyPromo: "Apply Promo Code",
    invalid: "Invalid promo code."
  }
};

function t(key) {
  return TEXT.en[key] || key;
}

function safeText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setCanvasDragging(isDragging) {
  canvas.classList.toggle("grabbing", isDragging);
}

function applyTranslations() {
  safeText("qrBtn", t("qrCodes"));
  safeText("qrTitle", t("qrTitle"));
  safeText("closeQr", t("close"));
  safeText("freezeBtn", t("freeze"));
  safeText("resetBtn", t("reset"));
  safeText("paywallTitle", t("session"));
  safeText("paywallLine1", t("message1"));
  safeText("paywallLine2", t("message2"));
  safeText("paywallPrice", t("price"));
  safeText("unlockBtn", t("unlock"));
  safeText("promoLabel", t("promo"));
  safeText("promoBtn", t("applyPromo"));

  const promoInput = document.getElementById("promoInput");
  if (promoInput) promoInput.placeholder = t("promoPlaceholder");
}

function syncControls() {
  const pitchModeSelect = document.getElementById("pitchMode");
  if (pitchModeSelect) pitchModeSelect.value = pitchMode;

  const playerGroupSelect = document.getElementById("playerGroup");
  if (playerGroupSelect) playerGroupSelect.value = playerGroup;

  const playerSizeSelect = document.getElementById("playerSize");
  if (playerSizeSelect) playerSizeSelect.value = playerSize;
}

function setPitchMode(mode, emit = true) {
  pitchMode = ["full", "half", "lineout"].includes(mode) ? mode : "full";
  state.pitchMode = pitchMode;

  if (pitchMode === "lineout") {
    playerGroup = "forwards";
  }

  applyActiveField();
  Object.values(state.players || {}).forEach(clampPlayer);
  if (state.ball) clampBall(state.ball);

  syncControls();
  if (emit) socket.emit("coach-pitch-mode", pitchMode);
  draw();
}

function updateToolVisibility() {
  sportMode = "rugby";
}

socket.on("state", serverState => {
  if (!serverState) return;

  state = serverState;
  sportMode = "rugby";

  if (state.pitchMode) pitchMode = state.pitchMode;

  applyActiveField();
  syncControls();
  updateToolVisibility();
  draw();
});

const pitchModeSelect = document.getElementById("pitchMode");
if (pitchModeSelect) pitchModeSelect.onchange = e => setPitchMode(e.target.value);

const setPieceBtn = document.getElementById("setPieceCycleBtn");

if (setPieceBtn) {
  setPieceBtn.onclick = () => {
    const options = [
      { type: "lineout", side: "top" },
      { type: "scrum", side: "top" },
      { type: "lineout", side: "bottom" },
      { type: "scrum", side: "bottom" }
    ];

    const option = options[setPieceCycle % options.length];
    setPieceCycle++;

    if (option.type === "lineout" && option.side === "top") {
      localPlaceLineout("top", W * 0.58);
      socket.emit("coach-setpiece", {
        type: "lineout",
        side: "top",
        x: W * 0.58,
        y: H * 0.25
      });
      setPieceBtn.textContent = "Set Piece";
    }

    else if (option.type === "scrum" && option.side === "top") {
      localPlaceScrum(W * 0.55, H * 0.32);
      socket.emit("coach-setpiece", {
        type: "scrum",
        x: W * 0.55,
        y: H * 0.32
      });
      setPieceBtn.textContent = "Set Piece";
    }

    else if (option.type === "lineout" && option.side === "bottom") {
      localPlaceLineout("bottom", W * 0.58);
      socket.emit("coach-setpiece", {
        type: "lineout",
        side: "bottom",
        x: W * 0.58,
        y: H * 0.72
      });
      setPieceBtn.textContent = "Set Piece";
    }

    else {
      localPlaceScrum(W * 0.55, H * 0.68);
      socket.emit("coach-setpiece", {
        type: "scrum",
        x: W * 0.55,
        y: H * 0.68
      });
      setPieceBtn.textContent = "Set Piece";
    }

    setupMode = "free";
    draw();
  };
}

const teamColorSelect = document.getElementById("teamColor");
if (teamColorSelect) {
  teamColorSelect.onchange = e => {
    const color = COLORS[e.target.value] || COLORS.red;
    Object.values(state.players || {}).forEach(p => {
      p.color = color;
    });
    socket.emit("coach-team-color", e.target.value);
    draw();
  };
}

const playerGroupSelect = document.getElementById("playerGroup");
if (playerGroupSelect) {
  playerGroupSelect.onchange = e => {
    playerGroup = e.target.value;
    syncControls();
    draw();
  };
}

const playerSizeSelect = document.getElementById("playerSize");
if (playerSizeSelect) {
  playerSizeSelect.onchange = e => {
    playerSize = e.target.value;
    Object.values(state.players || {}).forEach(clampPlayer);
    if (state.ball) clampBall(state.ball);
    syncControls();
    draw();
  };
}

const resetBtn = document.getElementById("resetBtn");
if (resetBtn) {
  resetBtn.onclick = () => {
    socket.emit("coach-reset");
    setupMode = "free";
  };
}

const freezeBtn = document.getElementById("freezeBtn");
if (freezeBtn) {
  freezeBtn.onclick = () => {
    state.frozen = !state.frozen;
    socket.emit("coach-freeze", state.frozen);
    draw();
  };
}

const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");

if (speedInput) {
  if (speedValue) {
    speedValue.textContent = `${(speedInput.value / 5).toFixed(1)}x`;
  }

  speedInput.oninput = e => {
    const value = Number(e.target.value);
    socket.emit("coach-speed", value);

    if (speedValue) {
      speedValue.textContent = `${(value / 5).toFixed(1)}x`;
    }
  };
}

function mousePoint(e) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function shouldShowPlayer(number) {
  if (playerGroup === "all") return true;
  if (playerGroup === "forwards") return number >= 1 && number <= 8;
  if (playerGroup === "backs") return number >= 9 && number <= 15;
  return true;
}

function playerHitRadius() {
  if (playerSize === "small") return 18;
  if (playerSize === "medium") return 20;
  return 24;
}

function getClosestPlayer(point) {
  if (!state || !state.players) return null;

  let closest = null;
  let best = Infinity;
  const radius = playerHitRadius();

  Object.values(state.players).forEach(player => {
    if (!shouldShowPlayer(player.number)) return;

    const d = Math.hypot(player.x - point.x, player.y - point.y);

    if (d < best) {
      best = d;
      closest = player;
    }
  });

  return best <= radius ? closest : null;
}

function isBallHit(point) {
  if (!state || !state.ball) return false;
  return Math.hypot(state.ball.x - point.x, state.ball.y - point.y) <= 28;
}

function localPlaceLineout(side, x) {
  if (!state || !state.players || !state.ball) return;

  const xForwards = clamp(x || 920, FIELD.left + 220, FIELD.right - 520);
  const spacing = side === "top" ? 34 : -34;
  const startY = side === "top" ? FIELD.top + 72 : FIELD.bottom - 72;
  const players = state.players;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    players[n].x = xForwards;
    players[n].y = startY + i * spacing;
  });

  players[2].x = xForwards - 78;
  players[2].y = startY - spacing * 0.2;

  players[9].x = xForwards + 76;
  players[9].y = startY + spacing * 4.2;

  const backsStartX = clamp(xForwards + 185, FIELD.left + 120, FIELD.right - 100);

  players[10].x = backsStartX;
  players[10].y = clamp(startY + spacing * 3.5, FIELD.top + 50, FIELD.bottom - 50);

  players[12].x = clamp(backsStartX + 105, FIELD.left + 100, FIELD.right - 70);
  players[12].y = clamp(startY + spacing * 4.3, FIELD.top + 50, FIELD.bottom - 50);

  players[13].x = clamp(backsStartX + 220, FIELD.left + 100, FIELD.right - 70);
  players[13].y = clamp(startY + spacing * 5.0, FIELD.top + 50, FIELD.bottom - 50);

  players[15].x = clamp(backsStartX + 330, FIELD.left + 100, FIELD.right - 70);
  players[15].y = clamp(startY + spacing * 5.9, FIELD.top + 50, FIELD.bottom - 50);

  players[14].x = clamp(backsStartX + 435, FIELD.left + 100, FIELD.right - 70);
  players[14].y = clamp(startY + spacing * 6.8, FIELD.top + 50, FIELD.bottom - 50);

  players[11].x = clamp(backsStartX + 160, FIELD.left + 100, FIELD.right - 70);
  players[11].y = clamp(startY + spacing * 1.6, FIELD.top + 50, FIELD.bottom - 50);

  state.ball.x = xForwards + 34;
  state.ball.y = startY + spacing * 1.4;

  Object.values(players).forEach(clampPlayer);
  clampBall(state.ball);
}

function localPlaceScrum(x, y) {
  if (!state || !state.players || !state.ball) return;

  const players = state.players;
  const cx = clamp(x || 720, FIELD.left + 180, FIELD.right - 580);
  const cy = clamp(y || 445, FIELD.top + 155, FIELD.bottom - 220);

  const gapX = 38;
  const gapY = 38;

  players[1].x = cx - gapX;
  players[1].y = cy - gapY;
  players[2].x = cx;
  players[2].y = cy - gapY;
  players[3].x = cx + gapX;
  players[3].y = cy - gapY;

  players[4].x = cx - 19;
  players[4].y = cy;
  players[5].x = cx + 19;
  players[5].y = cy;

  players[6].x = cx - 66;
  players[6].y = cy + gapY;
  players[7].x = cx + 66;
  players[7].y = cy + gapY;
  players[8].x = cx;
  players[8].y = cy + gapY + 18;

  players[9].x = cx + 150;
  players[9].y = cy + 14;

  players[10].x = clamp(cx + 265, FIELD.left + 100, FIELD.right - 70);
  players[10].y = clamp(cy + 42, FIELD.top + 50, FIELD.bottom - 50);

  players[12].x = clamp(cx + 375, FIELD.left + 100, FIELD.right - 70);
  players[12].y = clamp(cy + 82, FIELD.top + 50, FIELD.bottom - 50);

  players[13].x = clamp(cx + 500, FIELD.left + 100, FIELD.right - 70);
  players[13].y = clamp(cy + 132, FIELD.top + 50, FIELD.bottom - 50);

  players[15].x = clamp(cx + 605, FIELD.left + 100, FIELD.right - 70);
  players[15].y = clamp(cy + 195, FIELD.top + 50, FIELD.bottom - 50);

  players[14].x = clamp(cx + 710, FIELD.left + 100, FIELD.right - 70);
  players[14].y = clamp(cy + 245, FIELD.top + 50, FIELD.bottom - 50);

  players[11].x = clamp(cx + 440, FIELD.left + 100, FIELD.right - 70);
  players[11].y = clamp(cy - 118, FIELD.top + 50, FIELD.bottom - 50);

  state.ball.x = cx + 105;
  state.ball.y = cy + 8;

  Object.values(players).forEach(clampPlayer);
  clampBall(state.ball);
}

canvas.addEventListener("mousedown", e => {
  const rawPoint = mousePoint(e);
  const playerPoint = clampPointToField(rawPoint, false);
  const ballPoint = clampPointToField(rawPoint, true);

  if (isBallHit(rawPoint)) {
    draggingBall = true;
    draggingPlayerNumber = null;
    dragOffset.x = rawPoint.x - state.ball.x;
    dragOffset.y = rawPoint.y - state.ball.y;

    state.ball.x = ballPoint.x;
    state.ball.y = ballPoint.y;
    socket.emit("coach-ball", ballPoint);
    setCanvasDragging(true);
    draw();
    return;
  }

  const player = getClosestPlayer(rawPoint);

  if (player) {
    draggingPlayerNumber = player.number;
    draggingBall = false;
    dragOffset.x = rawPoint.x - player.x;
    dragOffset.y = rawPoint.y - player.y;

    player.x = playerPoint.x;
    player.y = playerPoint.y;
    clampPlayer(player);

    socket.emit("coach-move-player", {
      number: player.number,
      x: player.x,
      y: player.y
    });

    setCanvasDragging(true);
    draw();
    return;
  }

  draggingBall = true;
  draggingPlayerNumber = null;
  state.ball.x = ballPoint.x;
  state.ball.y = ballPoint.y;
  socket.emit("coach-ball", ballPoint);
  setCanvasDragging(true);
  draw();
});

canvas.addEventListener("mousemove", e => {
  const rawPoint = mousePoint(e);

  if (draggingPlayerNumber) {
    const player = state.players[draggingPlayerNumber];
    if (!player) return;

    player.x = rawPoint.x - dragOffset.x;
    player.y = rawPoint.y - dragOffset.y;
    clampPlayer(player);

    socket.emit("coach-move-player", {
      number: draggingPlayerNumber,
      x: player.x,
      y: player.y
    });

    draw();
    return;
  }

  if (draggingBall) {
    state.ball.x = rawPoint.x - dragOffset.x;
    state.ball.y = rawPoint.y - dragOffset.y;
    clampBall(state.ball);

    socket.emit("coach-ball", {
      x: state.ball.x,
      y: state.ball.y
    });

    draw();
  }
});

window.addEventListener("mouseup", () => {
  draggingBall = false;
  draggingPlayerNumber = null;
  setCanvasDragging(false);
});

canvas.addEventListener("mouseleave", () => {
  draggingBall = false;
  draggingPlayerNumber = null;
  setCanvasDragging(false);
});

canvas.addEventListener("dblclick", e => {
  const rawPoint = mousePoint(e);
  const player = getClosestPlayer(rawPoint);

  if (player) socket.emit("coach-attach-ball", player.number);
});

const qrBtn = document.getElementById("qrBtn");
if (qrBtn) {
  qrBtn.onclick = async () => {
    const modal = document.getElementById("qrModal");
    const grid = document.getElementById("qrGrid");

    if (!modal || !grid) return;

    modal.classList.remove("hidden");
    grid.innerHTML = "";

    const res = await fetch("/api/qrs");
    const data = await res.json();

    for (let i = 1; i <= 15; i++) {
      const item = document.createElement("div");
      item.className = "qrItem";

      item.innerHTML = `
        <div>Player ${i}</div>
        <img src="${data.qrs[i]}" />
        <div>${data.baseUrl}/controller.html?p=${i}</div>
      `;

      grid.appendChild(item);
    }
  };
}

const closeQr = document.getElementById("closeQr");
if (closeQr) {
  closeQr.onclick = () => {
    document.getElementById("qrModal")?.classList.add("hidden");
  };
}

function pixelText(text, x, y, size = 22, align = "center", color = "white") {
  ctx.save();
  ctx.font = `900 ${size}px Courier New`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.shadowColor = "#000";
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRugbyPitch() {
  applyActiveField();
  syncControls();

  if (pitchMode === "half") {
    drawHalfPitch();
    return;
  }

  if (pitchMode === "lineout") {
    drawLineoutPitch();
    return;
  }

  drawFullRugbyPitch();
}

function drawFullRugbyPitch() {
  if (rugbyPitchImg.complete && rugbyPitchImg.naturalWidth > 0) {
    ctx.drawImage(rugbyPitchImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#6ec65f";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawHalfPitch() {
  if (halfPitchImg.complete && halfPitchImg.naturalWidth > 0) {
    ctx.drawImage(halfPitchImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#6ec65f";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawLineoutPitch() {
  if (lineoutPitchImg.complete && lineoutPitchImg.naturalWidth > 0) {
    ctx.drawImage(lineoutPitchImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#6ec65f";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBall(ball) {
  if (!ball) return;

  ctx.save();

  ctx.translate(ball.x, ball.y);
  ctx.rotate(-0.35);

  ctx.drawImage(
    tcBallImg,
    -32,
    -20,
    64,
    40
  );

  ctx.restore();
}

function drawCirclePlayer(p) {
  const radius = 16;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 4, radius + 2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.color || COLORS.red;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = p.color === "#ffffff" ? "#111" : "#fff";
  ctx.font = "900 18px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.number, p.x, p.y + 1);

  ctx.restore();

  ctx.fillStyle = p.connected ? "#00ff7f" : "#ffdf4d";
  ctx.beginPath();
  ctx.arc(p.x + 15, p.y - 15, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPixelPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);

  const s = playerSize === "medium" ? 0.37 : 0.55;
  ctx.scale(s, s);

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(-24, 30, 48, 8);

  ctx.fillStyle = p.color || COLORS.red;
  ctx.fillRect(-22, -24, 44, 50);

  ctx.fillStyle = "#fff";
  ctx.fillRect(-15, -11, 30, 5);
  ctx.fillRect(-15, 2, 30, 5);

  ctx.fillStyle = "#111";
  ctx.fillRect(-16, 22, 11, 26);
  ctx.fillRect(5, 22, 11, 26);

  ctx.fillStyle = "#c88b62";
  ctx.fillRect(-18, -56, 36, 34);

  ctx.fillStyle = "#15100c";

  if (p.number <= 8) {
    ctx.fillRect(-27, -66, 54, 14);
    ctx.fillRect(-31, -54, 12, 22);
    ctx.fillRect(19, -54, 12, 22);
  } else {
    ctx.fillRect(-20, -66, 40, 12);
  }

  ctx.fillStyle = "#2a1a12";
  ctx.fillRect(-11, -37, 22, 8);
  ctx.fillRect(-7, -30, 14, 5);

  ctx.fillStyle = "#000";
  ctx.fillRect(-9, -48, 5, 5);
  ctx.fillRect(5, -48, 5, 5);

  ctx.fillStyle = "#fff";
  ctx.fillRect(-18, -20, 36, 34);

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.strokeRect(-18, -20, 36, 34);

  ctx.fillStyle = "#111";
  ctx.font = "900 28px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.number, 0, -2);

  ctx.restore();

  ctx.fillStyle = p.connected ? "#00ff7f" : "#ffdf4d";
  ctx.beginPath();
  ctx.arc(p.x + 18, p.y - 30, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(p) {
  if (!p || !shouldShowPlayer(p.number)) return;

  if (playerSize === "small") {
    drawCirclePlayer(p);
    return;
  }

  drawPixelPlayer(p);
}

function drawFooter() {
  const footerTop = H - 72;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, footerTop, W, 72);

  const modeText = `${t("freeBallMode")} | ${t("attack")} | ${pitchMode.toUpperCase()} PITCH`;

  pixelText(modeText, W / 2, footerTop + 28, 18, "center", "#ffd700");
  pixelText(t("footer"), W / 2, footerTop + 54, 13, "center", "#ffffff");
}

function draw() {
  drawRugbyPitch();

  if (state && state.players) {
    Object.values(state.players).forEach(drawPlayer);
  }

  if (state && state.ball) {
    drawBall(state.ball);
  }

  if (state && state.frozen) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, W, H);
    pixelText(t("freeze"), W / 2, H / 2, 90, "center", "#fff");
  }

  drawFooter();
}

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/28EeVdesG4TgcBz7D06Vq00";
const PAYWALL_WAIT_TIME = 5 * 60 * 1000;

let promoUnlockedThisPageLoad = false;

function hasValidAccess() {
  if (localStorage.getItem("subscriptionActive") === "true") return true;
  return promoUnlockedThisPageLoad === true;
}

function showPaywall() {
  if (hasValidAccess()) return;

  const overlay = document.getElementById("paywallOverlay");
  if (overlay) overlay.classList.remove("hidden");
}

function hidePaywall() {
  const overlay = document.getElementById("paywallOverlay");
  if (overlay) overlay.classList.add("hidden");
}

function unlockPromoForThisPageLoadOnly() {
  promoUnlockedThisPageLoad = true;
  hidePaywall();
}

window.addEventListener("load", () => {
  currentLang = "en";

  applyTranslations();
  applyActiveField();
  syncControls();
  updateToolVisibility();
  draw();

  if (!hasValidAccess()) {
    setTimeout(showPaywall, PAYWALL_WAIT_TIME);
  }

  const unlockBtn = document.getElementById("unlockBtn");

  if (unlockBtn) {
    unlockBtn.onclick = () => {
      window.location.href = STRIPE_PAYMENT_LINK;
    };
  }

  const promoBtn = document.getElementById("promoBtn");

  if (promoBtn) {
    promoBtn.onclick = () => {
      const input = document.getElementById("promoInput");
      const message = document.getElementById("promoMessage");
      const code = (input?.value || "").trim().toUpperCase();

      if (code === "AZRUGBY") {
        unlockPromoForThisPageLoadOnly();
      } else if (message) {
        message.textContent = t("invalid");
        message.style.color = "#ff5555";
      }
    };
  }
});