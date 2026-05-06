const socket = io();

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

let selectedPlay = null;
let selectedPlayer = 9;

let players = {};
let expectedPlayers = {};

let ball = { x: 800, y: 450 };

let simRunning = false;
let countdownValue = null;

const PLAYER_SPEED = 7;
let simSpeedMultiplier = 0.5;
let shadowGuideOn = true;

let timingClicks = {};

// =========================
// DRAW
// =========================

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

function drawPlayer(p, highlight = false, ghost = false) {
  ctx.save();

  ctx.translate(p.x, p.y);
  ctx.scale(0.55, 0.55);
  ctx.globalAlpha = ghost ? 0.28 : 1;

  ctx.fillStyle = ghost
    ? "#ffffff"
    : highlight
    ? "#ffd700"
    : p.color || "#d71920";

  ctx.fillRect(-22, -24, 44, 50);

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

function drawBall() {
  ctx.save();

  ctx.translate(ball.x, ball.y);
  ctx.rotate(-0.35);

  ctx.fillStyle = "#4b2a1b";
  ctx.fillRect(-22, -10, 44, 20);

  ctx.fillStyle = "#fff";
  ctx.fillRect(-18, -6, 5, 12);

  ctx.restore();
}

function drawCountdown() {
  if (countdownValue === null) return;

  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillRect(0, 0, W, H);

  const text = countdownValue === 0 ? "GO!" : String(countdownValue);

  pixelText(
    text,
    W / 2,
    H / 2,
    140,
    "center",
    countdownValue === 0 ? "#00ff7f" : "#ffd700"
  );
}

function drawFooter() {
  ctx.fillStyle = "rgba(0,0,0,.38)";
  ctx.fillRect(0, H - 82, W, 82);

  if (!selectedPlay) {
    pixelText("LOAD A PLAY TO BEGIN", W / 2, H - 45, 22, "center", "#ffd700");
    return;
  }

  if (simRunning) {
    pixelText(
      `REP LIVE | PLAYER ${selectedPlayer} | SPEED ${simSpeedMultiplier}x | SHADOW ${shadowGuideOn ? "ON" : "OFF"}`,
      W / 2,
      H - 45,
      20,
      "center",
      "#ffd700"
    );
    return;
  }

  pixelText(
    `READY | PLAYER ${selectedPlayer} | SPEED ${simSpeedMultiplier}x | SHADOW ${shadowGuideOn ? "ON" : "OFF"}`,
    W / 2,
    H - 45,
    20,
    "center",
    "#ffd700"
  );
}

function draw() {
  drawPitch();

  if (shadowGuideOn) {
    Object.values(expectedPlayers).forEach(p => {
      if (p.number === selectedPlayer) {
        drawPlayer(p, false, true);
      }
    });
  }

  Object.values(players).forEach(p => {
    drawPlayer(p, p.number === selectedPlayer, false);
  });

  drawBall();
  drawFooter();
  drawCountdown();
}

// =========================
// STORAGE
// =========================

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

// =========================
// LOAD PLAY
// =========================

function openPlayFolder() {
  const modal = document.getElementById("playModal");
  const list = document.getElementById("savedPlaysList");

  list.innerHTML = "";

  const plays = getSavedPlays();

  if (plays.length === 0) {
    list.innerHTML = `
      <div class="emptyFolder">
        📂 No saved plays found
      </div>
    `;
  }

  plays.forEach(play => {
    const item = document.createElement("div");
    item.className = "savedPlayItem";

    item.innerHTML = `
      <div>
        <div class="savedPlayName">📁 ${play.name}</div>
        <div class="savedPlayMeta">${play.steps.length} steps</div>
      </div>

      <button data-load="${play.id}">
        Load
      </button>
    `;

    list.appendChild(item);
  });

  list.querySelectorAll("[data-load]").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.load);
      selectedPlay = plays.find(p => p.id === id);

      if (!selectedPlay) return;

      loadStep(selectedPlay.steps[0]);
      modal.classList.add("hidden");
    };
  });

  modal.classList.remove("hidden");
}

// =========================
// QR CODES
// =========================

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

// =========================
// STEP + SIM
// =========================

function loadStep(step) {
  players = JSON.parse(JSON.stringify(step.players));
  expectedPlayers = JSON.parse(JSON.stringify(step.players));
  ball = JSON.parse(JSON.stringify(step.ball));
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

async function startSimulation() {
  if (!selectedPlay) {
    alert("Load a play first");
    return;
  }

  timingClicks = {};

  await countdown();

  simRunning = true;

  const steps = selectedPlay.steps;

  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];

    expectedPlayers = JSON.parse(JSON.stringify(step.players));
    ball = JSON.parse(JSON.stringify(step.ball));

    Object.values(players).forEach(p => {
      if (p.number === selectedPlayer) return;

      const target = step.players[p.number];
      if (!target) return;

      p.x = target.x;
      p.y = target.y;
    });

    draw();

    await new Promise(resolve =>
      setTimeout(resolve, 900 / simSpeedMultiplier)
    );
  }

  simRunning = false;
  calculateScore();
}

// =========================
// SCORING
// =========================

function calculateScore() {
  const expected = expectedPlayers[selectedPlayer];
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
    date: new Date().toLocaleString()
  });

  document.getElementById("scoreResult").innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:40px; flex-wrap:wrap;">
      <div>
        <div style="font-size:88px; line-height:1; margin-bottom:10px;">
          ${performanceIcon}
        </div>

        <div style="font-size:26px; font-weight:900; color:#ffd700; margin-bottom:20px;">
          ${performanceText}
        </div>
      </div>

      <div style="flex:1; min-width:280px;">
        <div style="font-size:72px; font-weight:900; color:#ffd700; margin-bottom:25px;">
          ${finalScore}/10
        </div>

        <div style="font-size:22px; margin-bottom:12px;">
          Positioning: ${positionScore}/5
        </div>

        <div style="font-size:22px; margin-bottom:12px;">
          Timing: ${timingScore}/5
        </div>

        <div style="font-size:22px; margin-bottom:12px;">
          Execution: ${executionScore}/5
        </div>

        <div style="font-size:18px; opacity:.8; margin-top:20px;">
          Distance from target: ${Math.round(dist)} px
        </div>

        <div style="font-size:16px; opacity:.75; margin-top:12px;">
          Shadow Guide: ${shadowGuideOn ? "ON" : "OFF"} | Speed: ${simSpeedMultiplier}x
        </div>
      </div>
    </div>
  `;

  document.getElementById("scoreModal").classList.remove("hidden");
}

// =========================
// SOCKETS
// =========================

socket.on("sim-player-move", data => {
  if (!simRunning) return;

  const player = players[Number(data.number)];
  if (!player) return;

  player.x += Number(data.dx || 0) * PLAYER_SPEED;
  player.y += Number(data.dy || 0) * PLAYER_SPEED;

  player.x = Math.max(40, Math.min(W - 40, player.x));
  player.y = Math.max(70, Math.min(H - 70, player.y));

  draw();
});

socket.on("sim-player-timing", data => {
  timingClicks[Number(data.number)] = Date.now();
});

// =========================
// BUTTONS
// =========================

document.getElementById("loadPlayBtn").onclick = openPlayFolder;
document.getElementById("qrBtn").onclick = openQrCodes;

document.getElementById("closeQr").onclick = () => {
  document.getElementById("qrModal").classList.add("hidden");
};

document.getElementById("closePlayModal").onclick = () => {
  document.getElementById("playModal").classList.add("hidden");
};

document.getElementById("closeScoreModal").onclick = () => {
  document.getElementById("scoreModal").classList.add("hidden");
};

document.getElementById("playerNumber").onchange = e => {
  selectedPlayer = Number(e.target.value);
  draw();
};

document.getElementById("startSimBtn").onclick = startSimulation;

document.getElementById("resetSimBtn").onclick = () => {
  if (selectedPlay) loadStep(selectedPlay.steps[0]);

  simRunning = false;
  countdownValue = null;
  draw();
};

const simSpeedInput = document.getElementById("simSpeed");
const simSpeedValue = document.getElementById("simSpeedValue");

if (simSpeedInput && simSpeedValue) {
  simSpeedInput.oninput = e => {
    simSpeedMultiplier = Number(e.target.value);
    simSpeedValue.textContent = simSpeedMultiplier + "x";
    draw();
  };
}

const shadowToggle = document.getElementById("shadowGuideToggle");

if (shadowToggle) {
  shadowToggle.onchange = e => {
    shadowGuideOn = e.target.checked;
    draw();
  };
}

// =========================
// START
// =========================

draw();
