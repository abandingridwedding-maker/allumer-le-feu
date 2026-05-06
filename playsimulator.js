const socket = io();

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

let selectedPlay = null;
let selectedPlayer = 9;

let players = {};
let ball = { x: 800, y: 450 };

let expectedPlayers = {};
let expectedBall = { x: 800, y: 450 };

let simRunning = false;
let simFinished = false;
let countdownValue = null;

let timingClicks = {};
let connectedPlayers = {};
let activePlayerTraces = {};

const PLAYER_SPEED = 7;

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

function drawPitch() {
  ctx.fillStyle = "#6ec65f";
  ctx.fillRect(0, 0, W, H);

  const left = 70;
  const right = W - 70;
  const top = 70;
  const bottom = H - 70;
  const pw = right - left;

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.strokeRect(left, top, right - left, bottom - top);

  const X = pct => left + pw * pct;

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
  [0.26, 0.50, 0.74].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(X(p), top);
    ctx.lineTo(X(p), bottom);
    ctx.stroke();
  });

  ctx.fillStyle = "#d71920";
  ctx.fillRect(0, 0, W, 52);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 52, W, 8);

  pixelText("TEAM-CLARITY PLAYER SIMULATOR", W / 2, 37, 30);
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

  ctx.fillStyle = "#fff";
  ctx.fillRect(-18, -6, 5, 12);
  ctx.fillRect(13, -6, 5, 12);

  ctx.restore();
}

function drawPlayer(p, highlight = false, ghost = false) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(0.55, 0.55);
  ctx.globalAlpha = ghost ? 0.35 : 1;

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
  ctx.fillRect(p.number <= 8 ? -27 : -20, -66, p.number <= 8 ? 54 : 40, 12);

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

  if (!ghost && connectedPlayers[p.number]) {
    ctx.fillStyle = "#00ff7f";
    ctx.beginPath();
    ctx.arc(p.x + 18, p.y - 30, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFooter() {
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(0, H - 82, W, 82);

  if (!selectedPlay) {
    pixelText("LOAD A PLAY TO BEGIN", W / 2, H - 48, 24, "center", "#ffd700");
    return;
  }

  if (simRunning) {
    pixelText(`REP LIVE | PLAYER ${selectedPlayer} CONTROLLING`, W / 2, H - 48, 24, "center", "#ffd700");
    return;
  }

  pixelText(`READY | PLAYER ${selectedPlayer} | SCAN QR THEN START REP`, W / 2, H - 48, 22, "center", "#ffd700");
}

function drawCountdown() {
  if (countdownValue === null) return;

  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, W, H);

  const text = countdownValue === 0 ? "GO!" : String(countdownValue);
  pixelText(text, W / 2, H / 2 + 30, 140, "center", countdownValue === 0 ? "#00ff7f" : "#ffd700");
}

function draw() {
  drawPitch();

  Object.values(expectedPlayers).forEach(p => {
    if (p.number === selectedPlayer) drawPlayer(p, false, true);
  });

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
        <div class="savedPlayMeta">${play.steps.length} steps</div>
      </div>
      <button data-load="${play.id}">Load</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll("[data-load]").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.load);
      selectedPlay = plays.find(p => p.id === id);
      if (!selectedPlay) return;

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

function loadStep(step, alsoExpected = false) {
  players = JSON.parse(JSON.stringify(step.players));
  ball = JSON.parse(JSON.stringify(step.ball));

  if (alsoExpected) {
    expectedPlayers = JSON.parse(JSON.stringify(step.players));
    expectedBall = JSON.parse(JSON.stringify(step.ball));
  }

  draw();
}

function interpolateExpected(from, to, smooth) {
  Object.values(expectedPlayers).forEach(p => {
    const a = from.players[p.number];
    const b = to.players[p.number];
    if (!a || !b) return;

    p.x = a.x + (b.x - a.x) * smooth;
    p.y = a.y + (b.y - a.y) * smooth;
  });

  expectedBall.x = from.ball.x + (to.ball.x - from.ball.x) * smooth;
  expectedBall.y = from.ball.y + (to.ball.y - from.ball.y) * smooth;

  ball.x = expectedBall.x;
  ball.y = expectedBall.y;

  Object.values(players).forEach(p => {
    if (p.number === selectedPlayer) return;

    const ghost = expectedPlayers[p.number];
    if (!ghost) return;

    p.x = ghost.x;
    p.y = ghost.y;
  });
}

function animateExpectedBetweenSteps(from, to, duration = 1000) {
  return new Promise(resolve => {
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const smooth = t * t * (3 - 2 * t);

      interpolateExpected(from, to, smooth);
      draw();

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }

    requestAnimationFrame(frame);
  });
}

async function countdown() {
  for (const value of [3, 2, 1, 0]) {
    countdownValue = value;
    draw();
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  countdownValue = null;
}

async function startSimulation() {
  if (!selectedPlay) {
    alert("Load a play first.");
    return;
  }

  simRunning = false;
  simFinished = false;
  timingClicks = {};
  activePlayerTraces = {};

  loadStep(selectedPlay.steps[0], true);

  await countdown();

  simRunning = true;

  const steps = selectedPlay.steps;

  for (let i = 1; i < steps.length; i++) {
    await animateExpectedBetweenSteps(steps[i - 1], steps[i], 1000);
  }

  simRunning = false;
  simFinished = true;
  calculateScore();
}

function calculateScore() {
  const finalStep = selectedPlay.steps[selectedPlay.steps.length - 1];

  const expected = finalStep.players[selectedPlayer];
  const actual = players[selectedPlayer];

  const dist = Math.hypot(expected.x - actual.x, expected.y - actual.y);

  let positionScore = 1;
  if (dist < 25) positionScore = 5;
  else if (dist < 55) positionScore = 4;
  else if (dist < 90) positionScore = 3;
  else if (dist < 130) positionScore = 2;

  const timingScore = timingClicks[selectedPlayer] ? 5 : 2;
  const total = positionScore + timingScore;

  document.getElementById("scoreResult").innerHTML = `
    <div class="bigScore">${total}/10</div>
    <div class="scoreLine">Positioning: ${positionScore}/5</div>
    <div class="scoreLine">Timing: ${timingScore}/5</div>
    <div class="scoreLine">Distance from target: ${Math.round(dist)} px</div>
  `;

  document.getElementById("scoreModal").classList.remove("hidden");
}

socket.on("sim-player-connected", data => {
  connectedPlayers[data.number] = data.connected;
  draw();
});

socket.on("sim-player-move", data => {
  if (!simRunning) return;

  const number = Number(data.number);
  const p = players[number];
  if (!p) return;

  p.x += Number(data.dx || 0) * PLAYER_SPEED;
  p.y += Number(data.dy || 0) * PLAYER_SPEED;

  p.x = Math.max(40, Math.min(W - 40, p.x));
  p.y = Math.max(70, Math.min(H - 70, p.y));

  draw();
});

socket.on("sim-player-timing", data => {
  timingClicks[Number(data.number)] = Date.now();
});

document.getElementById("loadPlayBtn").onclick = openPlayFolder;
document.getElementById("qrBtn").onclick = openQrCodes;
document.getElementById("closeQr").onclick = () => document.getElementById("qrModal").classList.add("hidden");
document.getElementById("closePlayModal").onclick = () => document.getElementById("playModal").classList.add("hidden");

document.getElementById("playerNumber").onchange = e => {
  selectedPlayer = Number(e.target.value);
  draw();
};

document.getElementById("startSimBtn").onclick = startSimulation;

document.getElementById("resetSimBtn").onclick = () => {
  if (selectedPlay) loadStep(selectedPlay.steps[0], true);
  simRunning = false;
  simFinished = false;
  countdownValue = null;
  draw();
};

document.getElementById("closeScoreModal").onclick = () => {
  document.getElementById("scoreModal").classList.add("hidden");
};

draw();
