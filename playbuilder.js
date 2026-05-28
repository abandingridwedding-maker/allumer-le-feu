import { supabase } from './supabase.js'

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

const FIELD = { left: 35, right: W - 35, top: 72, bottom: H - 82 };
const COLORS = { red: "#d71920", white: "#ffffff", black: "#111111", blue: "#1f6feb" };

let playerSize = "standard";
let playerGroup = "all";
let teamColor = COLORS.red;
let pitchMode = "full";
let currentPlayName = "";
let players = {};
let ball = { x: 950, y: 230 };
let draggingType = null;
let draggingPlayerNumber = null;
let dragOffset = { x: 0, y: 0 };
let builderStarted = false;
let steps = [];
let isAnimating = false;
let builderSpeedMultiplier = 1;
let setPieceCycle = 0;

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function applyActiveField() { Object.assign(FIELD, { left: 35, right: W - 35, top: 72, bottom: H - 82 }); }
function playerClampPadding() {
  if (playerSize === "small") return { x: 12, y: 12 };
  return { x: 18, y: 18 };
}
function ballClampPadding() { return { x: 24, y: 24 }; }
function clampPlayerToField(p) { if (!p) return; const pad = playerClampPadding(); p.x = clamp(p.x, FIELD.left + pad.x, FIELD.right - pad.x); p.y = clamp(p.y, FIELD.top + pad.y, FIELD.bottom - pad.y); }
function clampBallToField() { const pad = ballClampPadding(); ball.x = clamp(ball.x, FIELD.left + pad.x, FIELD.right - pad.x); ball.y = clamp(ball.y, FIELD.top + pad.y, FIELD.bottom - pad.y); }
function clampAllToField() { applyActiveField(); Object.values(players).forEach(clampPlayerToField); clampBallToField(); }
function setCanvasDragging(isDragging) { canvas.classList.toggle("grabbing", isDragging); }
function shouldShowPlayer(n) { if (playerGroup === "all") return true; if (playerGroup === "forwards") return n >= 1 && n <= 8; if (playerGroup === "backs") return n >= 9 && n <= 15; return true; }

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

function syncControls() {
  const pitch = document.getElementById("pitchMode");
  const group = document.getElementById("playerGroup");
  const size = document.getElementById("playerSize");
  if (pitch) pitch.value = pitchMode;
  if (group) group.value = playerGroup;
  if (size) size.value = playerSize;
}

function setPitchMode(mode) {
  pitchMode = ["full", "half", "lineout"].includes(mode) ? mode : "full";

  applyActiveField();

  if (pitchMode === "half") {
    playerGroup = "all";
    placeHalfPitchDefault();
  }

  else if (pitchMode === "lineout") {
    playerGroup = "forwards";
    placeLineoutPitchDefault();
  }

  else {
    playerGroup = "all";
    placeLineout("top", W * 0.58, true);
  }

  clampAllToField();
  syncControls();
  draw();
}

function applyTeamColor(value) {
  teamColor = COLORS[value] || COLORS.red;
  Object.values(players).forEach(p => p.color = teamColor);
  draw();
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

  setPitchMode(pitchMode);
}

function ensureWingsCorrect(players) {
  if (!players[11] || !players[14]) return;

  // Smaller Y = top of pitch.
  // 14 must always be above 11.
  if (players[14].y > players[11].y) {
    const old14 = { x: players[14].x, y: players[14].y };

    players[14].x = players[11].x;
    players[14].y = players[11].y;

    players[11].x = old14.x;
    players[11].y = old14.y;
  }
}

function placeLineout(side, clickedX, silent = false) {
  applyActiveField();

  const xForwards = clamp(clickedX || 920, FIELD.left + 240, FIELD.right - 520);
  const isTop = side === "top";
  const baseY = isTop ? FIELD.top + 92 : FIELD.bottom - 55;
  const dir = isTop ? 1 : -1;

  [1, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    players[n].x = xForwards;
    players[n].y = baseY + (i * 23 * dir);
  });

  players[2].x = xForwards - 70;
  players[2].y = baseY - (36 * dir);

  players[9].x = xForwards + 115;
  players[9].y = baseY + (35 * dir);

players[10].x = xForwards + 210;
  players[10].y = baseY + (155 * dir);

  players[14].x = xForwards + 280;
  players[14].y = baseY + (105 * dir);

  players[12].x = xForwards + 225;
  players[12].y = baseY + (250 * dir);

  players[13].x = xForwards + 270;
  players[13].y = baseY + (360 * dir);

  players[15].x = xForwards + 315;
  players[15].y = baseY + (480 * dir);

  players[11].x = xForwards + 355;
  players[11].y = baseY + (610 * dir);
  ball.x = xForwards - 55;
  ball.y = baseY + (315 * dir);

  ensureWingsCorrect(players);
  clampAllToField();

  if (!silent) draw();
}

function placeScrum(clickedX, clickedY) {
  applyActiveField();

  const cx = clamp(clickedX || W * 0.55, FIELD.left + 260, FIELD.right - 560);
  const isTop = !clickedY || clickedY < H / 2;
  const cy = isTop ? FIELD.top + 215 : FIELD.bottom - 215;
  const dir = isTop ? 1 : -1;

  players[1].x = cx - 45; players[1].y = cy + (45 * dir);
  players[2].x = cx - 45; players[2].y = cy;
  players[3].x = cx - 45; players[3].y = cy - (45 * dir);

  players[4].x = cx; players[4].y = cy + (25 * dir);
  players[5].x = cx; players[5].y = cy - (20 * dir);

  if (isTop) {
    players[6].x = cx + 42; players[6].y = cy - (62 * dir);
    players[7].x = cx + 42; players[7].y = cy + (62 * dir);
  } else {
    players[6].x = cx + 42; players[6].y = cy + (62 * dir);
    players[7].x = cx + 42; players[7].y = cy - (62 * dir);
  }

  players[8].x = cx + 40;
  players[8].y = cy;

  players[9].x = cx + 110;
  players[9].y = cy;

  const baseY = isTop ? FIELD.top + 92 : FIELD.bottom - 55;
  const xForwards = cx;

players[10].x = xForwards + 210;
  players[10].y = baseY + (155 * dir);

  players[14].x = xForwards + 280;
  players[14].y = baseY + (105 * dir);

  players[12].x = xForwards + 225;
  players[12].y = baseY + (250 * dir);

  players[13].x = xForwards + 270;
  players[13].y = baseY + (360 * dir);

  players[15].x = xForwards + 315;
  players[15].y = baseY + (480 * dir);

  players[11].x = xForwards + 355;
  players[11].y = baseY + (610 * dir);

  ball.x = cx + 70;
  ball.y = cy - (10 * dir);

  ensureWingsCorrect(players);
  clampAllToField();
  draw();
}

function placeHalfPitchDefault() {
  applyActiveField();

  const topY = FIELD.bottom - 230;
  const bottomY = FIELD.bottom - 110;

  for (let i = 1; i <= 8; i++) {
    players[i].x = FIELD.left + 300 + (i - 1) * 120;
    players[i].y = topY;
  }

  for (let i = 9; i <= 15; i++) {
    players[i].x = FIELD.left + 300 + (i - 9) * 120;
    players[i].y = bottomY;
  }

  ball.x = FIELD.left + 640;
  ball.y = topY - 60;

  clampAllToField();
}

function placeLineoutPitchDefault() {
  applyActiveField();

  playerGroup = "forwards";

  const y = H * 0.50;
  const startX = FIELD.left + 390;
  const spacing = 82;

  [1, 2, 3, 4, 5, 6, 7, 8].forEach((n, i) => {
    players[n].x = startX + i * spacing;
    players[n].y = y;
  });

  ball.x = FIELD.left + 675;
  ball.y = FIELD.top + 280;

  clampAllToField();
}

function cycleSetPiece() {
  if (pitchMode === "half" || pitchMode === "lineout") {
    const btn = document.getElementById("setPieceCycleBtn");
    if (btn) btn.textContent = "Set Piece";
    return;
  }

  const options = [
    { type: "lineout", side: "top" },
    { type: "scrum", side: "top" },
    { type: "lineout", side: "bottom" },
    { type: "scrum", side: "bottom" }
  ];

  const option = options[setPieceCycle % options.length];
  setPieceCycle++;

  if (option.type === "lineout" && option.side === "top") {
    placeLineout("top", W * 0.58);
  } else if (option.type === "scrum" && option.side === "top") {
    placeScrum(W * 0.55, H * 0.32);
  } else if (option.type === "lineout" && option.side === "bottom") {
    placeLineout("bottom", W * 0.58);
  } else {
    placeScrum(W * 0.55, H * 0.68);
  }

  const btn = document.getElementById("setPieceCycleBtn");
  if (btn) btn.textContent = "Set Piece";
  draw();
}

function drawPitch() {
  applyActiveField();
  syncControls();
  if (pitchMode === "half") return halfPitchImg.complete ? ctx.drawImage(halfPitchImg, 0, 0, W, H) : fallbackPitch();
  if (pitchMode === "lineout") return lineoutPitchImg.complete ? ctx.drawImage(lineoutPitchImg, 0, 0, W, H) : fallbackPitch();
  return rugbyPitchImg.complete ? ctx.drawImage(rugbyPitchImg, 0, 0, W, H) : fallbackPitch();
}

function fallbackPitch() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
}

function drawBall() {
  if (!ball) return;

  ctx.save();

  ctx.translate(ball.x, ball.y);
  ctx.rotate(-0.35);

  if (tcBallImg.complete && tcBallImg.naturalWidth > 0) {
    ctx.drawImage(tcBallImg, -32, -18, 64, 36);
  } else {
    ctx.fillStyle = "#ff5a1f";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 15, 0, 0, Math.PI * 2);

    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawCirclePlayer(p) {

  const radius =
    playerSize === "small"
      ? 11
      : 16;

  const fontSize =
    playerSize === "small"
      ? 13
      : 18;

  const stroke =
    playerSize === "small"
      ? 3
      : 4;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();

  ctx.ellipse(
    p.x + 3,
    p.y + 4,
    radius + 2,
    radius * 0.6,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle = p.color || COLORS.red;

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

  ctx.fill();

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = stroke;
  ctx.stroke();

  ctx.fillStyle =
    p.color === "#ffffff"
      ? "#111"
      : "#fff";

  ctx.font = `900 ${fontSize}px Courier New`;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    p.number,
    p.x,
    p.y + 1
  );

  ctx.restore();
}

function drawPixelPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(playerSize === "medium" ? 0.37 : 0.55, playerSize === "medium" ? 0.37 : 0.55);

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
  if (!p || !shouldShowPlayer(p.number)) return;
  drawCirclePlayer(p);
}

function drawFooter() {
  const y = H - 72;

  if (currentPlayName) {
    pixelText(currentPlayName.toUpperCase(), 45, 95, 24, "left", "#ffd700");
  }

  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.fillRect(0, y, W, 72);

  pixelText(
    builderStarted ? `BUILDER ACTIVE | NEXT: SAVE STEP ${steps.length + 1}` : "PLACE PLAYERS + BALL | CLICK START BUILDER",
    W / 2,
    y + 28,
    17,
    "center",
    "#ffd700"
  );

  pixelText(
    "Drag players or ball | Click SET PIECE to cycle formations",
    W / 2,
    y + 54,
    13,
    "center",
    "#fff"
  );
}

function draw() {
  if (!ctx) return;
  drawPitch();
  Object.values(players || {}).forEach(drawPlayer);
  drawBall();
  drawFooter();
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height)
  };
}

function ballHitTest(p) {
  return Math.hypot(ball.x - p.x, ball.y - p.y) < 28;
}

function playerHitTest(p) {
  let c = null;
  let b = Infinity;

  Object.values(players).forEach(pl => {
    if (!shouldShowPlayer(pl.number)) return;
    const d = Math.hypot(pl.x - p.x, pl.y - p.y);
    if (d < b) {
      b = d;
      c = pl;
    }
  });

  const r = playerSize === "small" ? 13 : 18;
  return b <= r ? c : null;
}canvas.addEventListener("mousedown", e => {
  if (isAnimating) return;

  const p = canvasPoint(e);

  if (ballHitTest(p)) {
    draggingType = "ball";
    draggingPlayerNumber = null;
    dragOffset.x = p.x - ball.x;
    dragOffset.y = p.y - ball.y;
    return setCanvasDragging(true);
  }

  const player = playerHitTest(p);

  if (player) {
    draggingType = "player";
    draggingPlayerNumber = player.number;
    dragOffset.x = p.x - player.x;
    dragOffset.y = p.y - player.y;
    return setCanvasDragging(true);
  }

  ball.x = p.x;
  ball.y = p.y;
  clampBallToField();
  draw();
});

canvas.addEventListener("mousemove", e => {
  const p = canvasPoint(e);

  if (draggingType === "ball") {
    ball.x = p.x - dragOffset.x;
    ball.y = p.y - dragOffset.y;
    clampBallToField();
    return draw();
  }

  if (draggingType === "player" && draggingPlayerNumber) {
    const pl = players[draggingPlayerNumber];
    pl.x = p.x - dragOffset.x;
    pl.y = p.y - dragOffset.y;
    clampPlayerToField(pl);
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
    pitchMode,
    playerGroup,
    playerSize
  };
}

function applyStep(step) {
  players = clone(step.players);
  ball = clone(step.ball);
  pitchMode = step.pitchMode || pitchMode;
  playerGroup = step.playerGroup || step.playerView || playerGroup || "all";
  playerSize = step.playerSize || playerSize || "small";

  Object.values(players).forEach(p => {
    p.color = teamColor;
    clampPlayerToField(p);
  });

  clampBallToField();
  syncControls();
  draw();
}

function updateBuilderButton() {
  const btn = document.getElementById("builderMainBtn");
  if (btn) btn.textContent = builderStarted ? `Save Step ${steps.length + 1}` : "Start Builder";
}

function builderMainAction() {
  if (!builderStarted) {
    builderStarted = true;
    steps = [];
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
      const s = t * t * (3 - 2 * t);

      Object.values(players).forEach(p => {
        const a = from.players[p.number];
        const b = to.players[p.number];

        if (!a || !b) return;

        p.x = a.x + (b.x - a.x) * s;
        p.y = a.y + (b.y - a.y) * s;
        p.color = teamColor;
      });

      ball.x = from.ball.x + (to.ball.x - from.ball.x) * s;
      ball.y = from.ball.y + (to.ball.y - from.ball.y) * s;

      draw();

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }

    requestAnimationFrame(frame);
  });
}

async function playAnimation() {
  if (steps.length < 2) return alert("Create at least 2 steps first.");

  isAnimating = true;
  applyStep(steps[0]);

  for (let i = 1; i < steps.length; i++) {
    await animateBetweenSteps(
      steps[i - 1],
      steps[i],
      900 / builderSpeedMultiplier
    );
  }

  isAnimating = false;
  draw();
}

async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

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

async function getOrCreateFolder(coachId, name) {
  const clean = name.trim();

  const { data: existing } = await supabase
    .from("folders")
    .select("*")
    .eq("coach_id", coachId)
    .eq("name", clean);

  if (existing?.length) return existing[0];

  const { data, error } = await supabase
    .from("folders")
    .insert({
      coach_id: coachId,
      name: clean
    })
    .select()
    .single();

  if (error) {
    alert(error.message);
    return null;
  }

  return data;
}

function setSaveMessage(message, isError = true) {
  const el = document.getElementById("savePlayMessage");
  if (!el) return;

  el.textContent = message || "";
  el.style.color = isError ? "#ff5a00" : "#16a34a";
}

function ensureSavePlayModal() {
  let modal = document.getElementById("savePlayModal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "savePlayModal";
  modal.className = "modal hidden";

  modal.innerHTML = `
    <div class="modalContent" style="width:min(1180px,92vw);max-width:1180px;border-radius:32px;padding:38px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;gap:24px;">
        <div>
          <div style="font-size:42px;font-weight:900;line-height:1;margin-bottom:10px;">💾 Save Play</div>
          <div style="font-size:15px;opacity:.65;line-height:1.5;">Choose an existing folder or create a new one, then give your play a name.</div>
        </div>
        <button id="closeSavePlayModal" type="button">Close</button>
      </div>

      <div style="display:grid;grid-template-columns:1.12fr .88fr;gap:26px;align-items:stretch;margin-bottom:26px;">
        <div class="folderCard" style="margin:0;padding:28px;border-radius:28px;min-height:335px;display:flex;flex-direction:column;">
          <div style="font-size:32px;font-weight:900;color:#ff5a00;">📁 Choose Folder</div>
          <div style="margin-top:8px;font-size:14px;opacity:.65;">Select an existing folder.</div>
          <div id="saveFolderList" style="display:grid;gap:12px;max-height:255px;overflow:auto;padding-right:8px;margin-top:18px;"></div>
        </div>

        <div class="folderCard" style="margin:0;padding:28px;border-radius:28px;min-height:335px;display:flex;flex-direction:column;">
          <div style="font-size:32px;font-weight:900;color:#ff5a00;">➕ New Folder</div>
          <div style="margin-top:8px;font-size:14px;opacity:.65;">Create a new folder now.</div>
          <input id="saveNewFolderName" type="text" placeholder="New folder name" style="width:100%;padding:18px 20px;border:1px solid #ddd;border-radius:18px;font-size:18px;box-sizing:border-box;margin-top:20px;"/>
        </div>
      </div>

      <div class="folderCard" style="margin:0 0 24px 0;padding:24px 28px;border-radius:28px;display:grid;grid-template-columns:170px 1fr;gap:18px;align-items:center;">
        <div style="font-size:30px;font-weight:900;color:#ff5a00;">🏉 Play Name</div>
        <input id="savePlayName" type="text" placeholder="Example: Lineout Exit 1" style="width:100%;padding:20px 22px;border:1px solid #ddd;border-radius:18px;font-size:19px;box-sizing:border-box;"/>
      </div>

      <div id="savePlayMessage" style="min-height:26px;font-size:15px;font-weight:800;margin-bottom:16px;color:#ff5a00;"></div>

      <div style="display:flex;justify-content:flex-end;gap:16px;margin-top:12px;">
        <button id="cancelSavePlayBtn" type="button">Cancel</button>
        <button id="confirmSavePlayBtn" type="button" class="modeActive">Save Play</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("closeSavePlayModal").onclick = () => modal.classList.add("hidden");
  document.getElementById("cancelSavePlayBtn").onclick = () => modal.classList.add("hidden");
  document.getElementById("confirmSavePlayBtn").onclick = confirmSavePlayFromModal;

  return modal;
}

async function openSavePlayModal() {
  if (steps.length < 1) return alert("Start builder and save at least one step first.");

  const modal = ensureSavePlayModal();
  const list = document.getElementById("saveFolderList");

  document.getElementById("savePlayName").value = "";
  document.getElementById("saveNewFolderName").value = "";

  setSaveMessage("");

  list.innerHTML = `<div class="savedPlayMeta">Loading folders...</div>`;
  modal.classList.remove("hidden");

  const folders = await loadCoachFolders();

  list.innerHTML = "";

  if (!folders.length) {
    list.innerHTML = `<div class="emptyFolder">No folders yet. Create a new folder on the right.</div>`;
    return;
  }

  folders.forEach((folder, index) => {
    const row = document.createElement("label");
    row.className = "savedPlayItem";
    row.style.cssText = "cursor:pointer;display:grid;grid-template-columns:1fr 28px;align-items:center;gap:16px;width:100%;box-sizing:border-box;padding:16px 18px;border-radius:18px;";

    row.innerHTML = `
      <div style="min-width:0;overflow:hidden;">
        <div class="savedPlayName" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:18px;line-height:1.15;margin-bottom:5px;">📁 ${folder.name}</div>
        <div class="savedPlayMeta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;line-height:1.25;">Share code: ${folder.share_code || ""}</div>
      </div>
      <input type="radio" name="saveFolderChoice" value="${folder.id}" ${index === 0 ? "checked" : ""} style="width:20px;height:20px;accent-color:#ff5a00;"/>
    `;

    list.appendChild(row);
  });
}

async function confirmSavePlayFromModal() {
  const user = await getCurrentUser();
  if (!user) return;

  const playName = (document.getElementById("savePlayName")?.value || "").trim();
  const newFolderName = (document.getElementById("saveNewFolderName")?.value || "").trim();
  const selected = document.querySelector('input[name="saveFolderChoice"]:checked');

  if (!playName) return setSaveMessage("Please name the play.");

  let folder = null;

  if (newFolderName) {
    folder = await getOrCreateFolder(user.id, newFolderName);
  } else if (selected?.value) {
    folder = (await loadCoachFolders()).find(f => String(f.id) === String(selected.value));
  }

  if (!folder) return setSaveMessage("Please choose a folder or create a new one.");

  const { error } = await supabase.from("plays").insert({
    folder_id: folder.id,
    coach_id: user.id,
    name: playName,
    play_data: {
      pitchMode,
      playerView: playerGroup,
      playerGroup,
      playerSize,
      steps: clone(steps)
    }
  });

  if (error) return setSaveMessage(error.message);

  currentPlayName = playName;
  setSaveMessage(`Saved into ${folder.name}.`, false);
  draw();

  setTimeout(() => {
    document.getElementById("savePlayModal")?.classList.add("hidden");
    openPlayFolder();
  }, 450);
}

async function savePlay() {
  openSavePlayModal();
}

async function createFolder() {
  const user = await getCurrentUser();
  const input = document.getElementById("newFolderName");
  const name = input?.value?.trim();

  if (!user || !name) return;

  const { error } = await supabase
    .from("folders")
    .insert({
      coach_id: user.id,
      name
    });

  if (error) return alert(error.message);

  input.value = "";
  openFoldersModal();
}

async function openFoldersModal() {
  const modal = document.getElementById("foldersModal");
  const list = document.getElementById("foldersList");

  if (!modal || !list) return;

  const folders = await loadCoachFolders();

  list.innerHTML = folders.length
    ? ""
    : `<div class="emptyFolder">No folders created yet.</div>`;

  folders.forEach(folder => {

    const item = document.createElement("div");
    item.className = "folderCard";

    item.innerHTML = `
      <div class="folderTitle">
        🗂 ${folder.name}
      </div>

      <div class="folderCode">
        Share Code:
      </div>

      <div class="shareCodeBadge">
        ${folder.share_code}
      </div>

      <div class="folderActions" style="margin-top:14px;">

        <button data-copy="${folder.share_code}">
  Copy Code
</button>

<button
  class="folderLogsBtn"
  data-folder-logs="${folder.id}"
>
  Logs
</button>

<button
  class="dangerBtn"
  data-delete-folder="${folder.id}"
>
  Delete
</button>

      </div>
    `;

    list.appendChild(item);

    // COPY CODE BUTTON
    const copyBtn = item.querySelector("[data-copy]");

    if (copyBtn) {
      copyBtn.onclick = async () => {

        await navigator.clipboard.writeText(
          folder.share_code
        );

        copyBtn.textContent = "Copied ✓";

        setTimeout(() => {
          copyBtn.textContent = "Copy Code";
        }, 1200);
      };
    }
// LOGS BUTTON
const logsBtn = item.querySelector(
  "[data-folder-logs]"
);

if (logsBtn) {

  logsBtn.onclick = async () => {

    window.location.href =
      `folder-logs.html?folder=${folder.id}`;

  };
}

    // DELETE FOLDER BUTTON
    const deleteBtn = item.querySelector(
      "[data-delete-folder]"
    );

    if (deleteBtn) {

      deleteBtn.onclick = async () => {

        const confirmDelete = confirm(
          `Delete folder "${folder.name}"?`
        );

        if (!confirmDelete) return;

        const { error } = await supabase
          .from("folders")
          .delete()
          .eq("id", folder.id);

        if (error) {
          alert(error.message);
          return;
        }

        openFoldersModal();
      };
    }

  });

  modal.classList.remove("hidden");
}

async function openPlayFolder() {
  const user = await getCurrentUser();
  if (!user) return;

  const modal = document.getElementById("playModal");
  const list = document.getElementById("savedPlaysList");

  if (!modal || !list) return;

  const { data: plays, error } = await supabase
    .from("plays")
    .select(`id,name,created_at,play_data,folders(name,share_code)`)
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return alert(error.message);

  list.innerHTML = plays?.length ? "" : `<div class="emptyFolder">📂 No saved plays yet.</div>`;

  (plays || []).forEach(play => {
    const item = document.createElement("div");
    item.className = "savedPlayItem";

    item.innerHTML = `
      <div>
        <div class="savedPlayName">📁 ${play.name}</div>
        <div class="savedPlayMeta">
          Folder: ${play.folders?.name || "No folder"} |
          ${play.play_data?.steps?.length || 0} steps |
          ${play.play_data?.pitchMode || "full"} pitch |
          ${play.play_data?.playerGroup || play.play_data?.playerView || "all"}
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
      const play = plays.find(p => p.id === btn.dataset.load);
      const data = play.play_data || {};

      currentPlayName = play.name || "";
      pitchMode = data.pitchMode || "full";
      playerGroup = data.playerGroup || data.playerView || "all";
      playerSize = data.playerSize || "small";
      steps = data.steps || [];
      builderStarted = true;

      syncControls();

      if (steps[0]) applyStep(steps[0]);

      updateBuilderButton();
      modal.classList.add("hidden");
    };
  });

  list.querySelectorAll("[data-delete]").forEach(btn => {

  btn.onclick = async () => {

    const confirmDelete = confirm("Delete this play?");

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("plays")
      .delete()
      .eq("id", btn.dataset.delete);

    if (error) {
      alert(error.message);
      return;
    }

    openPlayFolder();
  };

});

  modal.classList.remove("hidden");
}

function bind(id, event, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
}

bind("builderMainBtn", "click", builderMainAction);
bind("playAnimationBtn", "click", playAnimation);
bind("clearStepsBtn", "click", clearSteps);
bind("savePlayBtn", "click", savePlay);
bind("loadPlayBtn", "click", openPlayFolder);
bind("foldersBtn", "click", openFoldersModal);
bind("setPieceCycleBtn", "click", cycleSetPiece);
bind("closePlayModal", "click", () => document.getElementById("playModal")?.classList.add("hidden"));
bind("closeFoldersModal", "click", () => document.getElementById("foldersModal")?.classList.add("hidden"));
bind("createFolderBtn", "click", createFolder);
bind("teamColor", "change", e => applyTeamColor(e.target.value));
bind("pitchMode", "change", e => setPitchMode(e.target.value));
bind("playerGroup", "change", e => {
  playerGroup = e.target.value;
  syncControls();
  draw();
});
bind("playerSize", "change", e => {
  playerSize = e.target.value;
  clampAllToField();
  syncControls();
  draw();
});
bind("builderSpeed", "input", e => {
  builderSpeedMultiplier = Number(e.target.value) || 1;
  const v = document.getElementById("builderSpeedValue");
  if (v) v.textContent = Number(builderSpeedMultiplier).toFixed(2).replace(".00", "") + "x";
  draw();
});

applyActiveField();
syncControls();
initPlayers();
updateBuilderButton();
draw();

const APP_STRIPE_PAYMENT_LINK = "https://buy.stripe.com/fZu14n84iadA8Lj4q06Vq01";
const APP_PAYWALL_WAIT_TIME = 1 * 60 * 1000;

let appPromoUnlockedThisPageLoad = false;

function appHasValidAccess() {
  if (localStorage.getItem("subscriptionActive") === "true") return true;
  return appPromoUnlockedThisPageLoad === true;
}

function appShowPaywall() {
  if (appHasValidAccess()) return;

  const overlay = document.getElementById("paywallOverlay");
  if (overlay) overlay.classList.remove("hidden");
}

function appHidePaywall() {
  const overlay = document.getElementById("paywallOverlay");
  if (overlay) overlay.classList.add("hidden");
}

function appUnlockPromoForThisPageLoadOnly() {
  appPromoUnlockedThisPageLoad = true;
  appHidePaywall();
}

function startAppPaywall() {
  if (!appHasValidAccess()) {
    setTimeout(appShowPaywall, APP_PAYWALL_WAIT_TIME);
  }

  const unlockBtn = document.getElementById("unlockBtn");

  if (unlockBtn) {
    unlockBtn.onclick = () => {
      window.location.href = APP_STRIPE_PAYMENT_LINK;
    };
  }

  const promoBtn = document.getElementById("promoBtn");

  if (promoBtn) {
    promoBtn.onclick = () => {
      const input = document.getElementById("promoInput");
      const message = document.getElementById("promoMessage");
      const code = (input?.value || "").trim().toUpperCase();

      if (code === "AZRUGBY") {
        appUnlockPromoForThisPageLoadOnly();
      } else if (message) {
        message.textContent = "Invalid promo code.";
        message.style.color = "#ff5555";
      }
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startAppPaywall);
} else {
  startAppPaywall();
}