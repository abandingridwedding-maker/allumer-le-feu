import { supabase } from './supabase.js'

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

const FIELD = {
  left: 70,
  right: W - 70,
  top: 95,
  bottom: H - 145
};

const COLORS = {
  red: "#d71920",
  white: "#ffffff",
  black: "#111111",
  blue: "#1f6feb"
};

let setupMode = "free";
let playerSize = "small";
let playerGroup = "all";
let teamColorName = "red";
let teamColor = COLORS.red;
let pitchMode = "full";

let players = {};
let ball = { x: 950, y: 230 };

let draggingType = null;
let draggingPlayerNumber = null;
let dragOffset = { x: 0, y: 0 };

let builderStarted = false;
let steps = [];
let isAnimating = false;
let builderSpeedMultiplier = 1;

const builderBtn = document.getElementById("builderMainBtn");

function getPitchField(mode = pitchMode) {
  if (mode === "lineout") {
    const lineoutWidth = Math.round((W - 140) * 0.62);
    const left = Math.round((W - lineoutWidth) / 2);
    return { left, right: left + lineoutWidth, top: 95, bottom: H - 145 };
  }

  return { left: 70, right: W - 70, top: 95, bottom: H - 145 };
}

function applyActiveField() {
  Object.assign(FIELD, getPitchField());
}

function updatePitchModeSelect() {
  const select = document.getElementById("pitchMode");
  if (select) select.value = pitchMode;
}

function setPitchMode(mode) {
  pitchMode = ["full", "half", "lineout"].includes(mode) ? mode : "full";

  if (pitchMode === "lineout") {
    playerGroup = "forwards";
    const playerGroupSelect = document.getElementById("playerGroup");
    if (playerGroupSelect) playerGroupSelect.value = "forwards";
  }

  applyActiveField();
  clampAllToField();
  updatePitchModeSelect();
  draw();
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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

function setCanvasDragging(isDragging) {
  canvas.classList.toggle("grabbing", isDragging);
}

function shouldShowPlayer(number) {
  if (playerGroup === "all") return true;
  if (playerGroup === "forwards") return number >= 1 && number <= 8;
  if (playerGroup === "backs") return number >= 9 && number <= 15;
  return true;
}

function clearModeButtons() {
  ["lineoutTopBtn", "lineoutBottomBtn", "scrumBtn", "freeBtn"].forEach(id => {
    document.getElementById(id)?.classList.remove("modeActive");
  });
}

function updateModeButtons() {
  clearModeButtons();

  if (setupMode === "lineout-top") document.getElementById("lineoutTopBtn")?.classList.add("modeActive");
  if (setupMode === "lineout-bottom") document.getElementById("lineoutBottomBtn")?.classList.add("modeActive");
  if (setupMode === "scrum") document.getElementById("scrumBtn")?.classList.add("modeActive");
  if (setupMode === "free") document.getElementById("freeBtn")?.classList.add("modeActive");
}

function setMode(mode) {
  setupMode = mode;
  updateModeButtons();
  draw();
}

function clampAllToField() {
  applyActiveField();

  Object.values(players).forEach(p => {
    p.x = clamp(p.x, FIELD.left + 22, FIELD.right - 22);
    p.y = clamp(p.y, FIELD.top + 24, FIELD.bottom - 24);
  });

  ball.x = clamp(ball.x, FIELD.left + 22, FIELD.right - 22);
  ball.y = clamp(ball.y, FIELD.top + 24, FIELD.bottom - 24);
}

function initPlayers() {
  players = {};

  for (let i = 1; i <= 15; i++) {
    players[i] = {
      number: i,
      x: 500,
      y: 300,
      color: teamColor
    };
  }

  placeLineout("top", 920);
}

function applyTeamColor(value) {
  teamColorName = value;
  teamColor = COLORS[value] || COLORS.red;

  Object.values(players).forEach(p => {
    p.color = teamColor;
  });

  draw();
}

function placeLineout(side, clickedX) {
  const xForwards = clamp(clickedX || 920, FIELD.left + 220, FIELD.right - 520);
  const spacing = side === "top" ? 34 : -34;

  const topY = FIELD.top + 72;
  const bottomY = FIELD.bottom - 72;
  const startY = side === "top" ? topY : bottomY;

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

  ball.x = xForwards + 34;
  ball.y = startY + spacing * 1.4;

  clampAllToField();
  setupMode = "free";
  updateModeButtons();
  draw();
}

function placeScrum(clickedX, clickedY) {
  const cx = clamp(clickedX || 720, FIELD.left + 180, FIELD.right - 580);
  const cy = clamp(clickedY || 445, FIELD.top + 155, FIELD.bottom - 220);

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

  ball.x = cx + 105;
  ball.y = cy + 8;

  clampAllToField();
  setupMode = "free";
  updateModeButtons();
  draw();
}

function setFreeBall() {
  setupMode = "free";
  updateModeButtons();
  draw();
}

function drawPitchHeader(title) {
  ctx.fillStyle = "#d71920";
  ctx.fillRect(0, 0, W, 52);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 52, W, 8);

  pixelText(title, W / 2, 37, 30, "center", "#fff");
}

function drawFullPitch(title = "TEAM-CLARITY PLAY BUILDER") {
  ctx.fillStyle = "#6ec65f";
  ctx.fillRect(0, 0, W, H);

  const left = FIELD.left;
  const right = FIELD.right;
  const top = FIELD.top;
  const bottom = FIELD.bottom;

  const pw = right - left;
  const ph = bottom - top;

  const X = p => left + pw * p;
  const Y = p => top + ph * p;

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.strokeRect(left, top, pw, ph);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;

  [0.06, 0.94].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(X(p), top);
    ctx.lineTo(X(p), bottom);
    ctx.stroke();
  });

  ctx.setLineDash([16, 14]);

  [0.10, 0.90].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(X(p), top);
    ctx.lineTo(X(p), bottom);
    ctx.stroke();
  });

  ctx.setLineDash([]);
  ctx.lineWidth = 6;

  [0.26, 0.74].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(X(p), top);
    ctx.lineTo(X(p), bottom);
    ctx.stroke();
  });

  ctx.setLineDash([20, 16]);
  ctx.lineWidth = 4;

  [0.40, 0.60].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(X(p), top);
    ctx.lineTo(X(p), bottom);
    ctx.stroke();
  });

  ctx.setLineDash([]);

  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(X(0.50), top);
  ctx.lineTo(X(0.50), bottom);
  ctx.stroke();

  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 4;

  [0.08, 0.23, 0.77, 0.92].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(left, Y(p));
    ctx.lineTo(right, Y(p));
    ctx.stroke();
  });

  ctx.setLineDash([]);

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px Courier New";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  [["5m", 0.10], ["22m", 0.26], ["40m", 0.40], ["50m", 0.50], ["40m", 0.60], ["22m", 0.74], ["5m", 0.90]].forEach(([label, p]) => {
    ctx.fillText(label, X(p), bottom + 30);
  });

  ctx.textAlign = "left";
  ctx.fillText("5m", left + 8, Y(0.08) - 8);
  ctx.fillText("15m", left + 8, Y(0.23) - 8);
  ctx.fillText("15m", left + 8, Y(0.77) - 8);
  ctx.fillText("5m", left + 8, Y(0.92) - 8);

  ctx.textAlign = "right";
  ctx.fillText("5m", right - 8, Y(0.08) - 8);
  ctx.fillText("15m", right - 8, Y(0.23) - 8);
  ctx.fillText("15m", right - 8, Y(0.77) - 8);
  ctx.fillText("5m", right - 8, Y(0.92) - 8);

  ctx.restore();
  drawPitchHeader(title);
}function drawHalfPitch(title = "TEAM-CLARITY PLAY BUILDER") {
  ctx.fillStyle = "#6ec65f";
  ctx.fillRect(0, 0, W, H);

  const { left, right, top, bottom } = FIELD;
  const pw = right - left;
  const ph = bottom - top;
  const X = p => left + pw * p;
  const Y = p => top + ph * p;

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.strokeRect(left, top, pw, ph);

  ctx.lineWidth = 6;

  [["TRY", 1.0], ["5m", 0.88], ["22m", 0.56], ["40m", 0.22], ["50m", 0.0]].forEach(([label, p]) => {
    ctx.beginPath();
    ctx.moveTo(left, Y(p));
    ctx.lineTo(right, Y(p));
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.font = "900 20px Courier New";
    ctx.textAlign = "left";
    ctx.shadowColor = "#000";
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText(label, left + 12, Y(p) - 8);
    ctx.restore();
  });

  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 4;

  [["5m", 0.08], ["15m", 0.23], ["15m", 0.77], ["5m", 0.92]].forEach(([label, p]) => {
    ctx.beginPath();
    ctx.moveTo(X(p), top);
    ctx.lineTo(X(p), bottom);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.font = "900 18px Courier New";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText(label, X(p), bottom + 30);
    ctx.restore();
  });

  ctx.setLineDash([]);
  drawPitchHeader(title + " | HALF PITCH");
}

function drawLineoutPitch(title = "TEAM-CLARITY PLAY BUILDER") {
  ctx.fillStyle = "#6ec65f";
  ctx.fillRect(0, 0, W, H);

  const { left, right, top, bottom } = FIELD;
  const pw = right - left;
  const ph = bottom - top;

  const X = metres => left + pw * (metres / 17);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.strokeRect(left, top, pw, ph);

  ctx.lineWidth = 8;

  ctx.beginPath();
  ctx.moveTo(X(0), top);
  ctx.lineTo(X(0), bottom);
  ctx.stroke();

  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 5;

  [["5m", 5], ["15m", 15]].forEach(([label, metres]) => {
    ctx.beginPath();
    ctx.moveTo(X(metres), top);
    ctx.lineTo(X(metres), bottom);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.font = "900 22px Courier New";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText(label, X(metres), bottom + 34);
    ctx.restore();
  });

  ctx.setLineDash([]);

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "900 22px Courier New";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  ctx.fillText("5m", X(5), top + 34);
  ctx.fillText("15m", X(15), top + 34);

  ctx.restore();

  drawPitchHeader(title + " | LINEOUT");
}

function drawPitch() {
  applyActiveField();
  updatePitchModeSelect();

  if (pitchMode === "half") {
    drawHalfPitch();
    return;
  }

  if (pitchMode === "lineout") {
    drawLineoutPitch();
    return;
  }

  drawFullPitch();
}

function drawBall() {
  ctx.save();

  ctx.translate(ball.x, ball.y);
  ctx.rotate(-0.35);

  ctx.fillStyle = "#4b2a1b";
  ctx.fillRect(-22, -10, 44, 20);
  ctx.fillRect(-16, -15, 32, 30);
  ctx.fillRect(-8, -19, 16, 38);

  ctx.fillStyle = "#9b552f";
  ctx.fillRect(-16, -8, 32, 16);
  ctx.fillRect(-10, -12, 20, 24);

  ctx.fillStyle = "#fff";
  ctx.fillRect(-18, -6, 5, 12);
  ctx.fillRect(13, -6, 5, 12);
  ctx.fillRect(-2, -10, 4, 20);
  ctx.fillRect(-10, -2, 20, 4);

  ctx.restore();
}

function drawCirclePlayer(p) {
  const radius = 16;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 4, radius + 2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.color || "#d71920";

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
}

function drawPixelPlayer(p) {
  ctx.save();

  ctx.translate(p.x, p.y);

  const s = playerSize === "medium" ? 0.37 : 0.55;
  ctx.scale(s, s);

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(-24, 30, 48, 8);

  ctx.fillStyle = p.color || "#d71920";
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
}

function drawPlayer(p) {
  if (!shouldShowPlayer(p.number)) return;

  if (playerSize === "small") {
    drawCirclePlayer(p);
    return;
  }

  drawPixelPlayer(p);
}function drawFooter() {
  const footerTop = H - 72;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, footerTop, W, 72);

  const status = builderStarted
    ? `BUILDER ACTIVE | NEXT: SAVE STEP ${steps.length + 1}`
    : "PLACE PLAYERS + BALL | CLICK START BUILDER";

  let instruction = "Click Lineout/Scrum, then click field to place | Ball has click priority";

  if (setupMode === "lineout-top") instruction = "LINEOUT TOP: click on field to place the lineout";
  if (setupMode === "lineout-bottom") instruction = "LINEOUT BOTTOM: click on field to place the lineout";
  if (setupMode === "scrum") instruction = "SCRUM: click anywhere on field to place the scrum";

  pixelText(status, W / 2, footerTop + 28, 17, "center", "#ffd700");
  pixelText(instruction, W / 2, footerTop + 54, 13, "center", "#ffffff");
}

function draw() {
  drawPitch();
  Object.values(players).forEach(drawPlayer);
  drawBall();
  drawFooter();
}

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function ballHitTest(p) {
  return Math.hypot(ball.x - p.x, ball.y - p.y) < 28;
}

function playerHitTest(p) {
  let closest = null;
  let best = Infinity;

  Object.values(players).forEach(player => {
    if (!shouldShowPlayer(player.number)) return;

    const d = Math.hypot(player.x - p.x, player.y - p.y);

    if (d < best) {
      best = d;
      closest = player;
    }
  });

  const radius = playerSize === "small" ? 18 : playerSize === "medium" ? 20 : 24;

  return best <= radius ? closest : null;
}

canvas.addEventListener("mousedown", e => {
  if (isAnimating) return;

  const p = canvasPoint(e);

  if (setupMode === "lineout-top") {
    placeLineout("top", p.x);
    return;
  }

  if (setupMode === "lineout-bottom") {
    placeLineout("bottom", p.x);
    return;
  }

  if (setupMode === "scrum") {
    placeScrum(p.x, p.y);
    return;
  }

  if (ballHitTest(p)) {
    draggingType = "ball";
    draggingPlayerNumber = null;
    dragOffset.x = p.x - ball.x;
    dragOffset.y = p.y - ball.y;
    setCanvasDragging(true);
    return;
  }

  const player = playerHitTest(p);

  if (player) {
    draggingType = "player";
    draggingPlayerNumber = player.number;
    dragOffset.x = p.x - player.x;
    dragOffset.y = p.y - player.y;
    setCanvasDragging(true);
    return;
  }

  ball.x = clamp(p.x, FIELD.left + 22, FIELD.right - 22);
  ball.y = clamp(p.y, FIELD.top + 24, FIELD.bottom - 24);
  draw();
});

canvas.addEventListener("mousemove", e => {
  const p = canvasPoint(e);

  if (draggingType === "ball") {
    ball.x = clamp(p.x - dragOffset.x, FIELD.left + 22, FIELD.right - 22);
    ball.y = clamp(p.y - dragOffset.y, FIELD.top + 24, FIELD.bottom - 24);
    draw();
    return;
  }

  if (draggingType === "player" && draggingPlayerNumber) {
    players[draggingPlayerNumber].x = clamp(p.x - dragOffset.x, FIELD.left + 22, FIELD.right - 22);
    players[draggingPlayerNumber].y = clamp(p.y - dragOffset.y, FIELD.top + 24, FIELD.bottom - 24);
    draw();
  }
});

window.addEventListener("mouseup", () => {
  draggingType = null;
  draggingPlayerNumber = null;
  setCanvasDragging(false);
});

function captureStep() {
  return {
    players: clone(players),
    ball: clone(ball),
    pitchMode
  };
}

function applyStep(step) {
  players = clone(step.players);
  ball = clone(step.ball);
  if (step.pitchMode) pitchMode = step.pitchMode;
  applyActiveField();

  Object.values(players).forEach(p => {
    p.color = teamColor;
  });

  draw();
}

function updateBuilderButton() {
  if (!builderStarted) {
    builderBtn.textContent = "Start Builder";
  } else {
    builderBtn.textContent = `Save Step ${steps.length + 1}`;
  }
}

function builderMainAction() {
  if (!builderStarted) {
    builderStarted = true;
    steps = [];
    steps.push(captureStep());
    updateBuilderButton();
    draw();
    return;
  }

  steps.push(captureStep());
  updateBuilderButton();
  draw();
}

function clearSteps() {
  builderStarted = false;
  steps = [];
  updateBuilderButton();
  draw();
}

function animateBetweenSteps(from, to, duration = 900) {
  return new Promise(resolve => {
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const smooth = t * t * (3 - 2 * t);

      Object.values(players).forEach(p => {
        const a = from.players[p.number];
        const b = to.players[p.number];

        if (!a || !b) return;

        p.x = a.x + (b.x - a.x) * smooth;
        p.y = a.y + (b.y - a.y) * smooth;
        p.color = teamColor;
      });

      ball.x = from.ball.x + (to.ball.x - from.ball.x) * smooth;
      ball.y = from.ball.y + (to.ball.y - from.ball.y) * smooth;

      draw();

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

async function playAnimation() {
  if (steps.length < 2) {
    alert("Create at least 2 steps first.");
    return;
  }

  isAnimating = true;
  applyStep(steps[0]);

  const duration = 900 / builderSpeedMultiplier;

  for (let i = 1; i < steps.length; i++) {
    await animateBetweenSteps(steps[i - 1], steps[i], duration);
  }

  isAnimating = false;
  draw();
}

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    window.location.href = "auth.html";
    return null;
  }

  return user;
}

async function loadCoachFolders() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return [];
  }

  return data || [];
}

async function createFolder() {
  const user = await getCurrentUser();
  if (!user) return;

  const input = document.getElementById("newFolderName");
  const name = input.value.trim();

  if (!name) {
    alert("Enter a folder name.");
    return;
  }

  const { error } = await supabase
    .from("folders")
    .insert({
      coach_id: user.id,
      name
    });

  if (error) {
    alert(error.message);
    return;
  }

  input.value = "";
  openFoldersModal();
}

async function getOrCreateFolder(coachId, folderName) {
  const { data: existingFolders, error: findError } = await supabase
    .from("folders")
    .select("*")
    .eq("coach_id", coachId)
    .eq("name", folderName);

  if (findError) {
    alert(findError.message);
    return null;
  }

  if (existingFolders && existingFolders.length > 0) {
    return existingFolders[0];
  }

  const { data: newFolder, error: createError } = await supabase
    .from("folders")
    .insert({
      coach_id: coachId,
      name: folderName
    })
    .select()
    .single();

  if (createError) {
    alert(createError.message);
    return null;
  }

  return newFolder;
}

async function openFoldersModal() {
  const modal = document.getElementById("foldersModal");
  const list = document.getElementById("foldersList");

  const folders = await loadCoachFolders();

  list.innerHTML = "";

  if (folders.length === 0) {
    list.innerHTML = `<div class="emptyFolder">No folders created yet.</div>`;
  }

  folders.forEach(folder => {
    const item = document.createElement("div");
    item.className = "folderCard";

    const joinLink = `${window.location.origin}/joinfolder.html`;

    item.innerHTML = `
      <div class="folderTitle">🗂 ${folder.name}</div>
      <div class="folderCode">Share Code:</div>
      <div class="shareCodeBadge">${folder.share_code}</div>

      <div class="folderActions" style="margin-top:14px;">
        <button data-copy="${folder.share_code}">Copy Code</button>
        <button data-link="${joinLink}">Copy Join Link</button>
      </div>
    `;

    list.appendChild(item);
  });

  list.querySelectorAll("[data-copy]").forEach(btn => {
    btn.onclick = async () => {
      await navigator.clipboard.writeText(btn.dataset.copy);
      alert("Folder code copied.");
    };
  });

  list.querySelectorAll("[data-link]").forEach(btn => {
    btn.onclick = async () => {
      await navigator.clipboard.writeText(btn.dataset.link);
      alert("Join link copied.");
    };
  });

  modal.classList.remove("hidden");
}

async function savePlay() {
  if (steps.length < 1) {
    alert("Start builder and save at least one step first.");
    return;
  }

  const user = await getCurrentUser();
  if (!user) return;

  const folderName = prompt("Save into which folder?", "My Plays");
  if (!folderName) return;

  const playName = prompt("Play name?", "New Play");
  if (!playName) return;

  const folder = await getOrCreateFolder(user.id, folderName);
  if (!folder) return;

  const playData = {
  pitchMode,
  playerView: document.getElementById("playerGroup")?.value || "all",
  playerSize: document.getElementById("playerSize")?.value || "normal",
  steps: clone(steps)
};

  const { error } = await supabase
    .from("plays")
    .insert({
      folder_id: folder.id,
      coach_id: user.id,
      name: playName,
      play_data: playData
    });

  if (error) {
    alert(error.message);
    return;
  }

  alert(`Play saved into folder: ${folder.name}`);
  openPlayFolder();
}

async function openPlayFolder() {
  const user = await getCurrentUser();
  if (!user) return;

  const modal = document.getElementById("playModal");
  const list = document.getElementById("savedPlaysList");

  const { data: plays, error } = await supabase
    .from("plays")
    .select(`
      id,
      name,
      created_at,
      play_data,
      folders (
        name,
        share_code
      )
    `)
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }

  list.innerHTML = "";

  if (!plays || plays.length === 0) {
    list.innerHTML = `<div class="emptyFolder">📂 No saved plays yet.</div>`;
  }

  plays.forEach(play => {
    const item = document.createElement("div");
    item.className = "savedPlayItem";

    const folderName = play.folders?.name || "No folder";
    const shareCode = play.folders?.share_code || "";

    item.innerHTML = `
      <div>
        <div class="savedPlayName">📁 ${play.name}</div>
        <div class="savedPlayMeta">
          Folder: ${folderName} |
          ${play.play_data?.steps?.length || 0} steps |
          ${play.play_data?.pitchMode || "full"} pitch
        </div>
        <div class="savedPlayMeta">
          Share code: ${shareCode}
        </div>
      </div>

      <div>
        <button data-load="${play.id}">Load</button>
        <button data-delete="${play.id}">Delete</button>
      </div>
    `;

    list.appendChild(item);
  });

  list.querySelectorAll("[data-load]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.load;
      const play = plays.find(p => p.id === id);

      if (!play) return;

      const loadedData = play.play_data || {};

pitchMode = loadedData.pitchMode || "full";
playerGroup = loadedData.playerView || "all";
playerSize = loadedData.playerSize || "small";
steps = loadedData.steps || [];
builderStarted = true;

const playerGroupSelect = document.getElementById("playerGroup");
if (playerGroupSelect) playerGroupSelect.value = playerGroup;

const playerSizeSelect = document.getElementById("playerSize");
if (playerSizeSelect) playerSizeSelect.value = playerSize;

updatePitchModeSelect();

if (steps[0]) applyStep(steps[0]);

playerGroup = loadedData.playerView || "all";
playerSize = loadedData.playerSize || "small";

if (playerGroupSelect) playerGroupSelect.value = playerGroup;
if (playerSizeSelect) playerSizeSelect.value = playerSize;

updateBuilderButton();
draw();
modal.classList.add("hidden");
    };
  });

  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.delete;

      const { error: deleteError } = await supabase
        .from("plays")
        .delete()
        .eq("id", id);

      if (deleteError) {
        alert(deleteError.message);
        return;
      }

      openPlayFolder();
    };
  });

  modal.classList.remove("hidden");
}

document.getElementById("builderMainBtn").onclick = builderMainAction;
document.getElementById("playAnimationBtn").onclick = playAnimation;
document.getElementById("clearStepsBtn").onclick = clearSteps;
document.getElementById("savePlayBtn").onclick = savePlay;
document.getElementById("loadPlayBtn").onclick = openPlayFolder;
document.getElementById("foldersBtn").onclick = openFoldersModal;

document.getElementById("closePlayModal").onclick = () => document.getElementById("playModal").classList.add("hidden");
document.getElementById("closeFoldersModal").onclick = () => document.getElementById("foldersModal").classList.add("hidden");
document.getElementById("createFolderBtn").onclick = createFolder;

document.getElementById("lineoutTopBtn").onclick = () => setMode("lineout-top");
document.getElementById("lineoutBottomBtn").onclick = () => setMode("lineout-bottom");
document.getElementById("scrumBtn").onclick = () => setMode("scrum");
document.getElementById("freeBtn").onclick = setFreeBall;

document.getElementById("teamColor").onchange = e => applyTeamColor(e.target.value);
document.getElementById("pitchMode").onchange = e => setPitchMode(e.target.value);

document.getElementById("playerGroup").onchange = e => {
  playerGroup = e.target.value;
  draw();
};

document.getElementById("playerSize").onchange = e => {
  playerSize = e.target.value;
  draw();
};

applyActiveField();
updatePitchModeSelect();

const builderSpeed = document.getElementById("builderSpeed");
if (builderSpeed) {
  builderSpeed.oninput = e => {
    builderSpeedMultiplier = Number(e.target.value) || 1;
    const valueEl = document.getElementById("builderSpeedValue");
    if (valueEl) valueEl.textContent = builderSpeedMultiplier + "x";
    draw();
  };
}

initPlayers();
updateBuilderButton();
updateModeButtons();
draw();