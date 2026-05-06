const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

const FIELD = {
  left: 70,
  right: W - 70,
  top: 95,
  bottom: H - 125
};

const COLORS = {
  red: "#d71920",
  white: "#ffffff",
  black: "#111111",
  blue: "#1f6feb"
};

let setupMode = "free";
let playerSize = "normal";
let teamColorName = "red";
let teamColor = COLORS.red;

let players = {};
let ball = { x: 950, y: 230 };

let draggingType = null;
let draggingPlayerNumber = null;
let dragOffset = { x: 0, y: 0 };

let builderStarted = false;
let steps = [];
let isAnimating = false;

const builderBtn = document.getElementById("builderMainBtn");

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

/* =========================================
   INIT + SET PIECES
========================================= */

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

  setLineoutTop();
}

function applyTeamColor(value) {
  teamColorName = value;
  teamColor = COLORS[value] || COLORS.red;

  Object.values(players).forEach(p => {
    p.color = teamColor;
  });

  draw();
}

/*
  TEAM-CLARITY V2 STANDARD:
  Always right → left.
  9 and backs stay to the RIGHT of the forwards.
  Shape must remain visible and clean.
*/

function setLineoutTop() {
  setupMode = "lineout-top";

  const xForwards = 920;
  const startY = 160;
  const spacing = 42;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    players[n].x = xForwards;
    players[n].y = startY + i * spacing;
  });

  players[2].x = xForwards - 78;
  players[2].y = startY - 2;

  players[9].x = xForwards + 80;
  players[9].y = startY + 4.4 * spacing;

  players[10].x = xForwards + 190;
  players[10].y = startY + 3.6 * spacing;

  players[12].x = xForwards + 290;
  players[12].y = startY + 4.4 * spacing;

  players[13].x = xForwards + 405;
  players[13].y = startY + 5.2 * spacing;

  players[15].x = xForwards + 515;
  players[15].y = startY + 6.1 * spacing;

  players[14].x = xForwards + 620;
  players[14].y = startY + 7.0 * spacing;

  players[11].x = xForwards + 260;
  players[11].y = startY + 1.5 * spacing;

  ball.x = xForwards + 35;
  ball.y = startY + 48;

  clampAllToField();
  updateModeButtons();
  draw();
}

function setLineoutBottom() {
  setupMode = "lineout-bottom";

  const xForwards = 920;
  const startY = 720;
  const spacing = -42;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    players[n].x = xForwards;
    players[n].y = startY + i * spacing;
  });

  players[2].x = xForwards - 78;
  players[2].y = startY + 2;

  players[9].x = xForwards + 80;
  players[9].y = startY + 4.4 * spacing;

  players[10].x = xForwards + 190;
  players[10].y = startY + 3.6 * spacing;

  players[12].x = xForwards + 290;
  players[12].y = startY + 4.4 * spacing;

  players[13].x = xForwards + 405;
  players[13].y = startY + 5.2 * spacing;

  players[15].x = xForwards + 515;
  players[15].y = startY + 6.1 * spacing;

  players[14].x = xForwards + 620;
  players[14].y = startY + 7.0 * spacing;

  players[11].x = xForwards + 260;
  players[11].y = startY + 1.5 * spacing;

  ball.x = xForwards + 35;
  ball.y = startY - 48;

  clampAllToField();
  updateModeButtons();
  draw();
}

function setScrum() {
  setupMode = "scrum";

  const cx = 720;
  const cy = 445;
  const gap = 42;

  players[1].x = cx - gap;
  players[1].y = cy - gap;

  players[2].x = cx;
  players[2].y = cy - gap;

  players[3].x = cx + gap;
  players[3].y = cy - gap;

  players[4].x = cx - 22;
  players[4].y = cy;

  players[5].x = cx + 22;
  players[5].y = cy;

  players[6].x = cx - 72;
  players[6].y = cy + gap;

  players[7].x = cx + 72;
  players[7].y = cy + gap;

  players[8].x = cx;
  players[8].y = cy + gap + 20;

  players[9].x = cx + 165;
  players[9].y = cy + 18;

  players[10].x = cx + 285;
  players[10].y = cy + 48;

  players[12].x = cx + 395;
  players[12].y = cy + 90;

  players[13].x = cx + 520;
  players[13].y = cy + 140;

  players[15].x = cx + 625;
  players[15].y = cy + 205;

  players[14].x = cx + 735;
  players[14].y = cy + 255;

  players[11].x = cx + 455;
  players[11].y = cy - 120;

  ball.x = cx + 112;
  ball.y = cy + 12;

  clampAllToField();
  updateModeButtons();
  draw();
}

function setFreeBall() {
  setupMode = "free";
  updateModeButtons();
  draw();
}

function clampAllToField() {
  Object.values(players).forEach(p => {
    p.x = clamp(p.x, FIELD.left + 20, FIELD.right - 20);
    p.y = clamp(p.y, FIELD.top + 20, FIELD.bottom - 20);
  });

  ball.x = clamp(ball.x, FIELD.left + 20, FIELD.right - 20);
  ball.y = clamp(ball.y, FIELD.top + 20, FIELD.bottom - 20);
}

/* =========================================
   FIELD DRAWING
========================================= */

function drawPitch() {
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

  [
    ["5m", 0.10],
    ["22m", 0.26],
    ["40m", 0.40],
    ["50m", 0.50],
    ["40m", 0.60],
    ["22m", 0.74],
    ["5m", 0.90]
  ].forEach(([label, p]) => {
    ctx.fillText(label, X(p), bottom + 32);
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

  ctx.fillStyle = "#d71920";
  ctx.fillRect(0, 0, W, 52);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 52, W, 8);

  pixelText("TEAM-CLARITY PLAY BUILDER", W / 2, 37, 30, "center", "#fff");
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
  if (playerSize === "small") {
    drawCirclePlayer(p);
    return;
  }

  drawPixelPlayer(p);
}

/* =========================================
   STEP ARROWS
========================================= */

function drawArrow(x1, y1, x2, y2, color = "#ffd700") {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);

  if (dist < 8) return;

  const angle = Math.atan2(dy, dx);
  const headLength = 15;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.setLineDash([15, 10]);
  ctx.globalAlpha = 0.85;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawStepLines() {
  if (steps.length < 2) return;

  const a = steps[steps.length - 2];
  const b = steps[steps.length - 1];

  Object.values(b.players).forEach(p2 => {
    const p1 = a.players[p2.number];
    if (!p1) return;
    drawArrow(p1.x, p1.y, p2.x, p2.y, "#ffffff");
  });

  drawArrow(a.ball.x, a.ball.y, b.ball.x, b.ball.y, "#ffd700");
}

/* =========================================
   FOOTER
========================================= */

function drawFooter() {
  const footerTop = H - 70;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, footerTop, W, 70);

  const status = builderStarted
    ? `BUILDER ACTIVE | NEXT: SAVE STEP ${steps.length + 1}`
    : "PLACE PLAYERS + BALL | CLICK START BUILDER";

  pixelText(status, W / 2, footerTop + 28, 17, "center", "#ffd700");
  pixelText("Ball has click priority | Drag = fist cursor | Save/Load = 8-bit folder", W / 2, footerTop + 54, 13, "center", "#ffffff");
}

function draw() {
  drawPitch();
  drawStepLines();
  Object.values(players).forEach(drawPlayer);
  drawBall();
  drawFooter();
}

/* =========================================
   MOUSE / DRAGGING
========================================= */

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

  ball.x = clamp(p.x, FIELD.left + 20, FIELD.right - 20);
  ball.y = clamp(p.y, FIELD.top + 20, FIELD.bottom - 20);
  draw();
});

canvas.addEventListener("mousemove", e => {
  const p = canvasPoint(e);

  if (draggingType === "ball") {
    ball.x = clamp(p.x - dragOffset.x, FIELD.left + 20, FIELD.right - 20);
    ball.y = clamp(p.y - dragOffset.y, FIELD.top + 20, FIELD.bottom - 20);
    draw();
    return;
  }

  if (draggingType === "player" && draggingPlayerNumber) {
    players[draggingPlayerNumber].x = clamp(p.x - dragOffset.x, FIELD.left + 20, FIELD.right - 20);
    players[draggingPlayerNumber].y = clamp(p.y - dragOffset.y, FIELD.top + 20, FIELD.bottom - 20);
    draw();
  }
});

window.addEventListener("mouseup", () => {
  draggingType = null;
  draggingPlayerNumber = null;
  setCanvasDragging(false);
});

/* =========================================
   BUILDER LOGIC
========================================= */

function captureStep() {
  return {
    players: clone(players),
    ball: clone(ball),
    playerSize,
    teamColorName
  };
}

function applyStep(step) {
  players = clone(step.players);
  ball = clone(step.ball);
  playerSize = step.playerSize || playerSize;
  teamColorName = step.teamColorName || teamColorName;

  document.getElementById("playerSize").value = playerSize;
  document.getElementById("teamColor").value = teamColorName;

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

  for (let i = 1; i < steps.length; i++) {
    await animateBetweenSteps(steps[i - 1], steps[i], 900);
  }

  isAnimating = false;
  draw();
}

function getSavedPlays() {
  return JSON.parse(localStorage.getItem("teamClaritySavedPlays") || "[]");
}

function setSavedPlays(plays) {
  localStorage.setItem("teamClaritySavedPlays", JSON.stringify(plays));
}

function savePlay() {
  if (steps.length < 1) {
    alert("Start builder and save at least one step first.");
    return;
  }

  const name = prompt("Play name?", "New Play");

  if (!name) return;

  const plays = getSavedPlays();

  plays.push({
    id: Date.now(),
    name,
    createdAt: new Date().toLocaleString(),
    steps
  });

  setSavedPlays(plays);
  openPlayFolder();
}

function openPlayFolder() {
  const modal = document.getElementById("playModal");
  const list = document.getElementById("savedPlaysList");

  const plays = getSavedPlays();

  list.innerHTML = "";

  if (plays.length === 0) {
    list.innerHTML = `<div class="emptyFolder">📂 No saved plays yet.</div>`;
  }

  plays.forEach(play => {
    const item = document.createElement("div");
    item.className = "savedPlayItem";

    item.innerHTML = `
      <div>
        <div class="savedPlayName">📁 ${play.name}</div>
        <div class="savedPlayMeta">${play.steps.length} steps | ${play.createdAt}</div>
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
      const id = Number(btn.dataset.load);
      const play = getSavedPlays().find(p => p.id === id);

      if (!play) return;

      steps = play.steps || [];
      builderStarted = true;

      if (steps[0]) applyStep(steps[0]);

      updateBuilderButton();
      modal.classList.add("hidden");
    };
  });

  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.delete);
      setSavedPlays(getSavedPlays().filter(p => p.id !== id));
      openPlayFolder();
    };
  });

  modal.classList.remove("hidden");
}

/* =========================================
   BUTTON HOOKS
========================================= */

document.getElementById("builderMainBtn").onclick = builderMainAction;
document.getElementById("playAnimationBtn").onclick = playAnimation;
document.getElementById("clearStepsBtn").onclick = clearSteps;
document.getElementById("savePlayBtn").onclick = savePlay;
document.getElementById("loadPlayBtn").onclick = openPlayFolder;
document.getElementById("closePlayModal").onclick = () => document.getElementById("playModal").classList.add("hidden");

document.getElementById("lineoutTopBtn").onclick = setLineoutTop;
document.getElementById("lineoutBottomBtn").onclick = setLineoutBottom;
document.getElementById("scrumBtn").onclick = setScrum;
document.getElementById("freeBtn").onclick = setFreeBall;

document.getElementById("teamColor").onchange = e => applyTeamColor(e.target.value);

document.getElementById("playerSize").onchange = e => {
  playerSize = e.target.value;
  draw();
};

initPlayers();
updateBuilderButton();
updateModeButtons();
draw();
