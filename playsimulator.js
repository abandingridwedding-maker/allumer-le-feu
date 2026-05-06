const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

let selectedPlay = null;
let selectedPlayer = 10;

let currentStep = 0;
let simRunning = false;
let simFinished = false;

let players = {};
let ball = { x: 800, y: 450 };

let controlledPlayer = null;
let draggingPlayer = false;

let timingClicked = false;
let timingScore = 0;
let positionScore = 0;

// ========================================
// DRAW HELPERS
// ========================================

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

// ========================================
// PITCH
// ========================================

function drawPitch() {
  ctx.fillStyle = "#6ec65f";
  ctx.fillRect(0, 0, W, H);

  const left = 70;
  const right = W - 70;
  const top = 70;
  const bottom = H - 70;

  const pw = right - left;
  const ph = bottom - top;

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.strokeRect(left, top, pw, ph);

  const X = pct => left + pw * pct;
  const Y = pct => top + ph * pct;

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(X(0.06), top);
  ctx.lineTo(X(0.06), bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(X(0.94), top);
  ctx.lineTo(X(0.94), bottom);
  ctx.stroke();

  ctx.setLineDash([16, 14]);

  ctx.beginPath();
  ctx.moveTo(X(0.10), top);
  ctx.lineTo(X(0.10), bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(X(0.90), top);
  ctx.lineTo(X(0.90), bottom);
  ctx.stroke();

  ctx.setLineDash([]);

  ctx.lineWidth = 6;

  ctx.beginPath();
  ctx.moveTo(X(0.26), top);
  ctx.lineTo(X(0.26), bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(X(0.74), top);
  ctx.lineTo(X(0.74), bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(X(0.50), top);
  ctx.lineTo(X(0.50), bottom);
  ctx.stroke();

  ctx.fillStyle = "#d71920";
  ctx.fillRect(0, 0, W, 52);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 52, W, 8);

  pixelText("TEAM-CLARITY PLAY SIMULATOR", W / 2, 37, 30);
}

// ========================================
// BALL
// ========================================

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

  ctx.fillStyle = "#fff";

  ctx.fillRect(-18, -6, 5, 12);
  ctx.fillRect(13, -6, 5, 12);

  ctx.restore();
}

// ========================================
// PLAYER
// ========================================

function drawPlayer(p, highlight = false) {
  ctx.save();

  ctx.translate(p.x, p.y);
  ctx.scale(0.55, 0.55);

  ctx.fillStyle = highlight ? "#ffd700" : p.color;

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
  } else {
    ctx.fillRect(-20, -66, 40, 12);
  }

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

// ========================================
// FOOTER
// ========================================

function drawFooter() {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, H - 82, W, 82);

  if (!selectedPlay) {
    pixelText("LOAD A PLAY TO BEGIN", W / 2, H - 45, 22, "center", "#ffd700");
    return;
  }

  if (!simRunning) {
    pixelText(`READY | PLAYER ${selectedPlayer}`, W / 2, H - 45, 22, "center", "#ffd700");
    return;
  }

  pixelText(`SIM RUNNING | PLAYER ${selectedPlayer}`, W / 2, H - 45, 22, "center", "#ffd700");
}

// ========================================
// MAIN DRAW
// ========================================

function draw() {
  drawPitch();

  Object.values(players).forEach(p => {
    drawPlayer(p, p.number === selectedPlayer);
  });

  drawBall();
  drawFooter();
}

// ========================================
// STORAGE
// ========================================

function getSavedPlays() {
  return JSON.parse(localStorage.getItem("teamClaritySavedPlays") || "[]");
}

// ========================================
// PLAY MODAL
// ========================================

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
        <div class="savedPlayName">
          📁 ${play.name}
        </div>

        <div class="savedPlayMeta">
          ${play.steps.length} steps
        </div>
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

// ========================================
// LOAD STEP
// ========================================

function loadStep(step) {
  players = JSON.parse(JSON.stringify(step.players));
  ball = JSON.parse(JSON.stringify(step.ball));

  draw();
}

// ========================================
// ANIMATION
// ========================================

function animateBetweenSteps(from, to, duration = 950) {
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

// ========================================
// START SIMULATION
// ========================================

async function startSimulation() {
  if (!selectedPlay) {
    alert("Load a play first");
    return;
  }

  simRunning = true;

  const steps = selectedPlay.steps;

  loadStep(steps[0]);

  for (let i = 1; i < steps.length; i++) {
    currentStep = i;

    await animateBetweenSteps(
      steps[i - 1],
      steps[i],
      950
    );
  }

  simRunning = false;

  calculateScore();
}

// ========================================
// SCORING
// ========================================

function calculateScore() {
  const finalStep =
    selectedPlay.steps[selectedPlay.steps.length - 1];

  const expected =
    finalStep.players[selectedPlayer];

  const actual =
    players[selectedPlayer];

  const dist = Math.hypot(
    expected.x - actual.x,
    expected.y - actual.y
  );

  if (dist < 25) positionScore = 5;
  else if (dist < 55) positionScore = 4;
  else if (dist < 90) positionScore = 3;
  else if (dist < 130) positionScore = 2;
  else positionScore = 1;

  timingScore = timingClicked ? 5 : 2;

  const total = positionScore + timingScore;

  document.getElementById("scoreResult").innerHTML = `
    <div class="bigScore">${total}/10</div>

    <div class="scoreLine">
      Positioning: ${positionScore}/5
    </div>

    <div class="scoreLine">
      Timing: ${timingScore}/5
    </div>
  `;

  document
    .getElementById("scoreModal")
    .classList.remove("hidden");
}

// ========================================
// MOUSE HELPERS
// ========================================

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (e.clientX - rect.left) *
       (canvas.width / rect.width),

    y: (e.clientY - rect.top) *
       (canvas.height / rect.height)
  };
}

function hitPlayer(p) {
  let closest = null;
  let best = 9999;

  Object.values(players).forEach(player => {
    if (player.number !== selectedPlayer) return;

    const d = Math.hypot(
      player.x - p.x,
      player.y - p.y
    );

    if (d < best) {
      best = d;
      closest = player;
    }
  });

  return best < 42 ? closest : null;
}

// ========================================
// DRAGGING
// ========================================

canvas.addEventListener("mousedown", e => {
  if (!simRunning) return;

  const p = canvasPoint(e);

  const player = hitPlayer(p);

  if (player) {
    controlledPlayer = player;
    draggingPlayer = true;

    canvas.classList.add("grabbing");
  }
});

canvas.addEventListener("mousemove", e => {
  if (!draggingPlayer || !controlledPlayer) return;

  const p = canvasPoint(e);

  controlledPlayer.x = p.x;
  controlledPlayer.y = p.y;

  draw();
});

window.addEventListener("mouseup", () => {
  draggingPlayer = false;
  controlledPlayer = null;

  canvas.classList.remove("grabbing");
});

// ========================================
// BUTTONS
// ========================================

document.getElementById("loadPlayBtn").onclick =
  openPlayFolder;

document.getElementById("closePlayModal").onclick =
  () => {
    document
      .getElementById("playModal")
      .classList.add("hidden");
  };

document.getElementById("playerNumber").onchange =
  e => {
    selectedPlayer = Number(e.target.value);

    draw();
  };

document.getElementById("startSimBtn").onclick =
  startSimulation;

document.getElementById("resetSimBtn").onclick =
  () => {
    if (selectedPlay) {
      loadStep(selectedPlay.steps[0]);
    }

    simRunning = false;

    draw();
  };

document.getElementById("confirmTimingBtn").onclick =
  () => {
    if (!simRunning) return;

    timingClicked = true;
  };

document.getElementById("closeScoreModal").onclick =
  () => {
    document
      .getElementById("scoreModal")
      .classList.add("hidden");
  };

// ========================================
// START
// ========================================

draw();
