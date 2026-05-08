const socket = io();

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

let selectedPlay = null;
let selectedPlayer = 7;

let playerSize = "normal";
let shadowGuideOn = true;
let simSpeedMultiplier = 0.5;
let pitchMode = "full";

let players = {};
let expectedPlayers = {};
let ball = { x: 820, y: 430 };

let simRunning = false;
let countdownValue = null;
let timingClicks = {};
let sessionStartTime = null;

const PLAYER_SPEED = 7;

const FIELD = {
  left: 70,
  right: W - 70,
  top: 95,
  bottom: H - 125
};



function getPitchField(mode = pitchMode) {
  if (mode === "lineout") {
    return { left: 70, right: Math.round(W * 0.62), top: 95, bottom: H - 125 };
  }

  return { left: 70, right: W - 70, top: 95, bottom: H - 125 };
}

function applyActiveField() {
  Object.assign(FIELD, getPitchField());
}

function updatePitchModeSelect() {
  const select = document.getElementById("pitchMode");
  if (select) select.value = pitchMode;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
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

function drawPitchHeader(title) {
  ctx.fillStyle = "#d71920";
  ctx.fillRect(0, 0, W, 52);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 52, W, 8);
  pixelText(title, W / 2, 37, 30, "center", "#fff");
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

function drawFullPitch() {
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
  [0.06, 0.94].forEach(p => { ctx.beginPath(); ctx.moveTo(X(p), top); ctx.lineTo(X(p), bottom); ctx.stroke(); });
  ctx.setLineDash([16, 14]);
  [0.10, 0.90].forEach(p => { ctx.beginPath(); ctx.moveTo(X(p), top); ctx.lineTo(X(p), bottom); ctx.stroke(); });
  ctx.setLineDash([]);
  ctx.lineWidth = 6;
  [0.26, 0.74].forEach(p => { ctx.beginPath(); ctx.moveTo(X(p), top); ctx.lineTo(X(p), bottom); ctx.stroke(); });
  ctx.setLineDash([20, 16]);
  ctx.lineWidth = 4;
  [0.40, 0.60].forEach(p => { ctx.beginPath(); ctx.moveTo(X(p), top); ctx.lineTo(X(p), bottom); ctx.stroke(); });
  ctx.setLineDash([]);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(X(0.50), top); ctx.lineTo(X(0.50), bottom); ctx.stroke();
  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 4;
  [0.08, 0.23, 0.77, 0.92].forEach(p => { ctx.beginPath(); ctx.moveTo(left, Y(p)); ctx.lineTo(right, Y(p)); ctx.stroke(); });
  ctx.setLineDash([]);

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px Courier New";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  [["5m", 0.10], ["22m", 0.26], ["40m", 0.40], ["50m", 0.50], ["40m", 0.60], ["22m", 0.74], ["5m", 0.90]].forEach(([label, p]) => ctx.fillText(label, X(p), bottom + 30));
  ctx.textAlign = "left";
  [["5m",0.08],["15m",0.23],["15m",0.77],["5m",0.92]].forEach(([label,p]) => ctx.fillText(label, left + 8, Y(p) - 8));
  ctx.textAlign = "right";
  [["5m",0.08],["15m",0.23],["15m",0.77],["5m",0.92]].forEach(([label,p]) => ctx.fillText(label, right - 8, Y(p) - 8));
  ctx.restore();

  drawPitchHeader("TEAM-CLARITY PLAYER SIMULATOR");
}

function drawHalfPitch() {
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
    ctx.beginPath(); ctx.moveTo(left, Y(p)); ctx.lineTo(right, Y(p)); ctx.stroke();
    pixelText(label, left + 18, Y(p) - 8, 18, "left", "#fff");
  });
  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 4;
  [["5m",0.08],["15m",0.23],["15m",0.77],["5m",0.92]].forEach(([label,p]) => {
    ctx.beginPath(); ctx.moveTo(X(p), top); ctx.lineTo(X(p), bottom); ctx.stroke();
    pixelText(label, X(p), bottom + 30, 16, "center", "#fff");
  });
  ctx.setLineDash([]);
  drawPitchHeader("TEAM-CLARITY PLAYER SIMULATOR | HALF PITCH");
}

function drawLineoutPitch() {
  ctx.fillStyle = "#6ec65f";
  ctx.fillRect(0, 0, W, H);
  const { left, right, top, bottom } = FIELD;
  const pw = right - left;
  const X = p => left + pw * p;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.strokeRect(left, top, pw, bottom - top);
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.stroke();
  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 5;
  [["5m",0.20],["15m",0.48]].forEach(([label,p]) => {
    ctx.beginPath(); ctx.moveTo(X(p), top); ctx.lineTo(X(p), bottom); ctx.stroke();
    pixelText(label, X(p), bottom + 34, 20, "center", "#fff");
  });
  ctx.setLineDash([]);
  pixelText("TOUCHLINE", left + 15, top + 35, 18, "left", "#fff");
  drawPitchHeader("TEAM-CLARITY PLAYER SIMULATOR | LINEOUT");
}

function drawBall(ballObj = ball) {
  ctx.save();
  ctx.translate(ballObj.x, ballObj.y);
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

function drawCirclePlayer(p, highlight = false, ghost = false) {
  ctx.save();

  const radius = 16;

  ctx.globalAlpha = ghost ? 0.28 : 1;

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 4, radius + 2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ghost ? "#ffffff" : highlight ? "#ffd700" : p.color || "#d71920";
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ghost ? "#ffd700" : "#fff";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#111";
  ctx.font = "900 18px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.number, p.x, p.y + 1);

  ctx.restore();
}

function drawPlayer(p, highlight = false, ghost = false) {
  if (playerSize === "small") {
    drawCirclePlayer(p, highlight, ghost);
    return;
  }

  ctx.save();
  ctx.translate(p.x, p.y);

  const s = playerSize === "medium" ? 0.37 : 0.55;
  ctx.scale(s, s);
  ctx.globalAlpha = ghost ? 0.28 : 1;

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(-24, 30, 48, 8);

  ctx.fillStyle = ghost ? "#ffffff" : highlight ? "#ffd700" : p.color || "#d71920";
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

  if (highlight && !ghost) {
    ctx.save();
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 8, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFooter() {
  const footerTop = H - 92;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, footerTop, W, 92);

  if (!selectedPlay) {
    pixelText("LOAD A PLAY TO BEGIN", W / 2, footerTop + 34, 24, "center", "#ffd700");
    pixelText("Choose a saved play from Play Builder, then scan QR codes for controllers", W / 2, footerTop + 70, 14, "center", "#fff");
    return;
  }

  const status = simRunning ? "REP LIVE" : "READY";

  pixelText(
    `${status} | PLAYER ${selectedPlayer} | SPEED ${simSpeedMultiplier}x | SHADOW ${shadowGuideOn ? "ON" : "OFF"}`,
    W / 2,
    footerTop + 34,
    22,
    "center",
    "#ffd700"
  );

  pixelText(selectedPlay.name || "Loaded Play", W / 2, footerTop + 70, 14, "center", "#fff");
}

function drawCountdown() {
  if (countdownValue === null) return;

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);

  const text = countdownValue === 0 ? "GO!" : String(countdownValue);

  pixelText(
    text,
    W / 2,
    H / 2 + 35,
    140,
    "center",
    countdownValue === 0 ? "#00ff7f" : "#ffd700"
  );
}

function draw() {
  drawPitch();

  if (shadowGuideOn && expectedPlayers[selectedPlayer]) {
    drawPlayer(expectedPlayers[selectedPlayer], false, true);
  }

  Object.values(players).forEach(p => {
    drawPlayer(p, p.number === selectedPlayer, false);
  });

  drawBall(ball);
  drawFooter();
  drawCountdown();
}

function getSavedPlays() {
  return JSON.parse(localStorage.getItem("teamClaritySavedPlays") || "[]");
}

function getTrainingLogs() {
  return JSON.parse(localStorage.getItem("teamClarityTrainingLogs") || "[]");
}

function saveTrainingLog(log) {
  const logs = getTrainingLogs();
  logs.push(log);
  localStorage.setItem("teamClarityTrainingLogs", JSON.stringify(logs));
}

function openPlayFolder() {
  const modal = document.getElementById("playModal");
  const list = document.getElementById("savedPlaysList");
  const plays = getSavedPlays();

  list.innerHTML = "";

  if (plays.length === 0) {
    list.innerHTML = `<div class="emptyFolder">📂 No saved plays found.</div>`;
  }

  plays.forEach(play => {
    const item = document.createElement("div");
    item.className = "savedPlayItem";

    item.innerHTML = `
      <div>
        <div class="savedPlayName">📁 ${play.name}</div>
        <div class="savedPlayMeta">${play.steps.length} steps | ${play.pitchMode || "full"} pitch</div>
      </div>
      <button data-load="${play.id}">Load</button>
    `;

    list.appendChild(item);
  });

  list.querySelectorAll("[data-load]").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.load);
      selectedPlay = plays.find(p => p.id === id);

      if (!selectedPlay || !selectedPlay.steps || selectedPlay.steps.length === 0) return;

      pitchMode = selectedPlay.pitchMode || selectedPlay.steps?.[0]?.pitchMode || "full";
      applyActiveField();
      updatePitchModeSelect();
      loadStep(selectedPlay.steps[0], true);
      modal.classList.add("hidden");
    };
  });

  modal.classList.remove("hidden");
}

async function openQrCodes() {
  const modal = document.getElementById("qrModal");
  const grid = document.getElementById("qrGrid");

  modal.classList.remove("hidden");
  grid.innerHTML = "";

  const res = await fetch("/api/sim-qrs");
  const data = await res.json();

  for (let i = 1; i <= 15; i++) {
    const item = document.createElement("div");
    item.className = "qrItem";
    item.innerHTML = `
      <div>Player ${i}</div>
      <img src="${data.qrs[i]}">
      <div>${data.baseUrl}/simcontroller.html?p=${i}</div>
    `;
    grid.appendChild(item);
  }
}

function openLogs() {
  const modal = document.getElementById("logsModal");
  const list = document.getElementById("logsList");
  const logs = getTrainingLogs().slice().reverse();

  list.innerHTML = "";

  if (logs.length === 0) {
    list.innerHTML = `<div class="emptyFolder">No training logs yet.</div>`;
  }

  logs.forEach(log => {
    const item = document.createElement("div");
    item.className = "savedPlayItem";
    item.innerHTML = `
      <div>
        <div class="savedPlayName">Player ${log.player} — ${log.score}/10</div>
        <div class="savedPlayMeta">${log.play} | ${log.date}</div>
        <div class="savedPlayMeta">
          Positioning ${log.positioning}/5 | Timing ${log.timing}/5 | Execution ${log.execution}/5 |
          Shadow ${log.shadowGuide ? "ON" : "OFF"} | Speed ${log.speed}x
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  modal.classList.remove("hidden");
}

function loadStep(step, resetExpected = false) {
  players = clone(step.players);
  ball = clone(step.ball);
  applyActiveField();

  if (resetExpected) {
    expectedPlayers = clone(step.players);
  }

  draw();
}

async function countdown() {
  for (const value of [3, 2, 1, 0]) {
    countdownValue = value;
    draw();
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  countdownValue = null;
}

function interpolateStep(from, to, t) {
  const smooth = t * t * (3 - 2 * t);

  Object.values(expectedPlayers).forEach(p => {
    const a = from.players[p.number];
    const b = to.players[p.number];

    if (!a || !b) return;

    p.x = a.x + (b.x - a.x) * smooth;
    p.y = a.y + (b.y - a.y) * smooth;
  });

  Object.values(players).forEach(p => {
    if (p.number === selectedPlayer) return;

    const target = expectedPlayers[p.number];
    if (!target) return;

    p.x = target.x;
    p.y = target.y;
  });

  ball.x = from.ball.x + (to.ball.x - from.ball.x) * smooth;
  ball.y = from.ball.y + (to.ball.y - from.ball.y) * smooth;
}

function animateBetweenSteps(from, to, duration) {
  return new Promise(resolve => {
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);

      interpolateStep(from, to, t);
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

async function startSimulation() {
  if (!selectedPlay || !selectedPlay.steps || selectedPlay.steps.length < 2) {
    alert("Load a play with at least 2 steps first.");
    return;
  }

  timingClicks = {};
  sessionStartTime = Date.now();

  loadStep(selectedPlay.steps[0], true);

  await countdown();

  simRunning = true;

  const duration = 900 / simSpeedMultiplier;
  const steps = selectedPlay.steps;

  for (let i = 1; i < steps.length; i++) {
    await animateBetweenSteps(steps[i - 1], steps[i], duration);
  }

  simRunning = false;
  calculateScore();
}

function calculateScore() {
  const finalStep = selectedPlay.steps[selectedPlay.steps.length - 1];
  const expected = finalStep.players[selectedPlayer];
  const actual = players[selectedPlayer];

  if (!expected || !actual) return;

  const dist = Math.hypot(expected.x - actual.x, expected.y - actual.y);

  let positionScore = 1;
  if (dist < 25) positionScore = 5;
  else if (dist < 55) positionScore = 4;
  else if (dist < 90) positionScore = 3;
  else if (dist < 130) positionScore = 2;

  let timingScore = 2;
  if (timingClicks[selectedPlayer]) timingScore = 5;
  else if (dist < 80) timingScore = 4;
  else if (dist < 140) timingScore = 3;

  let executionScore = 2;
  if (dist < 35) executionScore = 5;
  else if (dist < 75) executionScore = 4;
  else if (dist < 120) executionScore = 3;

  const rawTotal = positionScore + timingScore + executionScore;
  const finalScore = Math.round((rawTotal / 15) * 10);
  const timeSpentSeconds = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;

  let performanceIcon = "🏆";
  let performanceText = "Elite Rep";

  if (finalScore >= 8) {
    performanceIcon = "🏆";
    performanceText = "Elite Rep";
  } else if (finalScore >= 6) {
    performanceIcon = "🔥";
    performanceText = "Solid Rep";
  } else {
    performanceIcon = "🛠️";
    performanceText = "Keep Working";
  }

  saveTrainingLog({
    player: selectedPlayer,
    play: selectedPlay?.name || "Unknown Play",
    score: finalScore,
    positioning: positionScore,
    timing: timingScore,
    execution: executionScore,
    distance: Math.round(dist),
    shadowGuide: shadowGuideOn,
    speed: simSpeedMultiplier,
    timeSpentSeconds,
    date: new Date().toLocaleString()
  });

  document.getElementById("scoreResult").innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:40px; flex-wrap:wrap;">
      <div>
        <div style="font-size:88px; line-height:1; margin-bottom:10px;">${performanceIcon}</div>
        <div style="font-size:26px; font-weight:900; color:#ffd700; margin-bottom:20px;">${performanceText}</div>
      </div>

      <div style="flex:1; min-width:280px;">
        <div style="font-size:72px; font-weight:900; color:#ffd700; margin-bottom:25px;">${finalScore}/10</div>
        <div style="font-size:22px; margin-bottom:12px;">Positioning: ${positionScore}/5</div>
        <div style="font-size:22px; margin-bottom:12px;">Timing: ${timingScore}/5</div>
        <div style="font-size:22px; margin-bottom:12px;">Execution: ${executionScore}/5</div>
        <div style="font-size:18px; opacity:.8; margin-top:20px;">Distance from target: ${Math.round(dist)} px</div>
        <div style="font-size:16px; opacity:.75; margin-top:12px;">
          Time: ${timeSpentSeconds}s | Shadow: ${shadowGuideOn ? "ON" : "OFF"} | Speed: ${simSpeedMultiplier}x
        </div>
      </div>
    </div>
  `;

  document.getElementById("scoreModal").classList.remove("hidden");
}

socket.on("sim-player-move", data => {
  if (!simRunning) return;

  const number = Number(data.number);
  const player = players[number];

  if (!player) return;

  player.x += Number(data.dx || 0) * PLAYER_SPEED;
  player.y += Number(data.dy || 0) * PLAYER_SPEED;

  player.x = Math.max(FIELD.left + 22, Math.min(FIELD.right - 22, player.x));
  player.y = Math.max(FIELD.top + 24, Math.min(FIELD.bottom - 24, player.y));

  draw();
});

socket.on("sim-player-timing", data => {
  timingClicks[Number(data.number)] = Date.now();
});

document.getElementById("loadPlayBtn").onclick = openPlayFolder;
document.getElementById("qrBtn").onclick = openQrCodes;
document.getElementById("logsBtn").onclick = openLogs;

document.getElementById("closeQr").onclick = () => document.getElementById("qrModal").classList.add("hidden");
document.getElementById("closePlayModal").onclick = () => document.getElementById("playModal").classList.add("hidden");
document.getElementById("closeScoreModal").onclick = () => document.getElementById("scoreModal").classList.add("hidden");
document.getElementById("closeLogsModal").onclick = () => document.getElementById("logsModal").classList.add("hidden");

document.getElementById("playerNumber").onchange = e => {
  selectedPlayer = Number(e.target.value);
  draw();
};

document.getElementById("playerSize").onchange = e => {
  playerSize = e.target.value;
  draw();
};

document.getElementById("startSimBtn").onclick = startSimulation;

document.getElementById("resetSimBtn").onclick = () => {
  if (selectedPlay) loadStep(selectedPlay.steps[0], true);

  simRunning = false;
  countdownValue = null;
  timingClicks = {};
  draw();
};

document.getElementById("simSpeed").oninput = e => {
  simSpeedMultiplier = Number(e.target.value);
  document.getElementById("simSpeedValue").textContent = simSpeedMultiplier + "x";
  draw();
};

document.getElementById("shadowGuideToggle").onchange = e => {
  shadowGuideOn = e.target.checked;
  draw();
};

draw();
