import { supabase } from './supabase.js'

const tcBallImg = new Image();
tcBallImg.src = "assets/tc-ball.png";

const socket = io();

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

let selectedPlay = null;
let selectedPlayer = 7;
let playerSize = "standard";
let shadowGuideOn = true;
let simSpeedMultiplier = 0.5;
let pitchMode = "full";
let playerGroup = "all";

let players = {};
let expectedPlayers = {};
let ball = { x: 820, y: 430 };

let opposition = {};
let oppositionEnabled = false;
let oppositionColor = "#1f6feb";
let activeNotes = [];
let notesGuideOn = true;

let simRunning = false;
let countdownValue = null;
let timingClicks = {};
let sessionStartTime = null;

const BASE_PLAYER_SPEED = 4;

const FIELD = {
  left: 35,
  right: W - 35,
  top: 72,
  bottom: H - 82
};

function getPitchField(mode = pitchMode) {
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
  if (playerSize === "small") return { x: 12, y: 12 };
  return { x: 18, y: 18 };
}

function ballClampPadding() {
  return { x: 24, y: 24 };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clampPlayer(player) {
  if (!player) return;
  const pad = playerClampPadding();
  player.x = clamp(player.x, FIELD.left + pad.x, FIELD.right - pad.x);
  player.y = clamp(player.y, FIELD.top + pad.y, FIELD.bottom - pad.y);
}

function clampBall(ballObj = ball) {
  if (!ballObj) return;
  const pad = ballClampPadding();
  ballObj.x = clamp(ballObj.x, FIELD.left + pad.x, FIELD.right - pad.x);
  ballObj.y = clamp(ballObj.y, FIELD.top + pad.y, FIELD.bottom - pad.y);
}

function clampAll() {
  applyActiveField();
  Object.values(players || {}).forEach(clampPlayer);
  Object.values(expectedPlayers || {}).forEach(clampPlayer);
  Object.values(opposition || {}).forEach(clampPlayer);
  clampBall(ball);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatSpeed(value) {
  return Number(value).toFixed(2).replace(".00", "") + "x";
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

function drawPlayNameOverlay() {
  if (!selectedPlay?.name) return;

  const label = selectedPlay.name.toUpperCase();

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(28, 72, Math.min(520, 34 + label.length * 15), 44);
  ctx.strokeStyle = "rgba(255,215,0,0.85)";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 72, Math.min(520, 34 + label.length * 15), 44);
  ctx.restore();

  pixelText(label, 45, 101, 22, "left", "#ffd700");
}

function shouldShowPlayer(number) {
  if (playerGroup === "all") return true;
  if (playerGroup === "forwards") return number >= 1 && number <= 8;
  if (playerGroup === "backs") return number >= 9 && number <= 15;
  return true;
}

function updateControls() {
  const sizeSelect = document.getElementById("playerSize");
  if (sizeSelect) sizeSelect.value = playerSize;

  const playerSelect = document.getElementById("playerNumber");
  if (playerSelect) playerSelect.value = selectedPlayer;

  const speedValue = document.getElementById("simSpeedValue");
  if (speedValue) speedValue.textContent = formatSpeed(simSpeedMultiplier);
}

function updatePitchModeSelect() {
  const select = document.getElementById("pitchMode");
  if (select) select.value = pitchMode;
}

function drawFullPitch() {
  if (rugbyPitchImg.complete && rugbyPitchImg.naturalWidth > 0) {
    ctx.drawImage(rugbyPitchImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawHalfPitch() {
  if (halfPitchImg.complete && halfPitchImg.naturalWidth > 0) {
    ctx.drawImage(halfPitchImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawLineoutPitch() {
  if (lineoutPitchImg.complete && lineoutPitchImg.naturalWidth > 0) {
    ctx.drawImage(lineoutPitchImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPitch() {
  applyActiveField();
  updatePitchModeSelect();
  ctx.clearRect(0, 0, W, H);

  if (pitchMode === "lineout") {
    drawLineoutPitch();
    return;
  }

  if (pitchMode === "half") {
    drawHalfPitch();
    return;
  }

  drawFullPitch();
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

function drawCirclePlayer(p, highlight = false, ghost = false) {
  if (!p) return;

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

  ctx.fillStyle = "#fff";
ctx.font = "900 18px Courier New";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.strokeStyle = "rgba(0,0,0,0.35)";
ctx.lineWidth = 2;
ctx.strokeText(p.number, p.x, p.y + 1);
ctx.fillText(p.number, p.x, p.y + 1);

  ctx.restore();
}

function drawPixelPlayer(p, highlight = false, ghost = false) {
  if (!p) return;

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

function drawPlayer(p, highlight = false, ghost = false) {
  if (!p) return;
  if (!shouldShowPlayer(Number(p.number))) return;
  drawCirclePlayer(p, highlight, ghost);
}

function drawOppositionPlayer(p) {
  if (!p) return;
  if (!shouldShowPlayer(Number(p.number))) return;
  drawCirclePlayer(p, false, false);
}

function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function edgePointToward(bx, by, bw, bh, tx, ty) {
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = bw / 2;
  const hh = bh / 2;
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function annotationAnchor(a) {
  if (a.type === "player") {
    const src = a.team === "opposition" ? opposition : players;
    const p = src[a.playerNumber];
    if (p) return { x: p.x, y: p.y };
  }
  return { x: a.ax, y: a.ay };
}

function annotationVisible(a) {
  if (a.type === "player") {
    if (a.team === "opposition" && !oppositionEnabled) return false;
    return shouldShowPlayer(Number(a.playerNumber));
  }
  return true;
}

function measureAnnotation(a) {
  ctx.save();
  ctx.font = "700 22px Arial";
  const maxTextWidth = 260;
  const words = String(a.text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach(w => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxTextWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  });

  if (line) lines.push(line);
  if (!lines.length) lines.push("");

  let textW = 0;
  lines.forEach(l => { textW = Math.max(textW, ctx.measureText(l).width); });
  ctx.restore();

  const padX = 18;
  const padY = 16;
  const lineH = 28;
  const w = Math.max(140, textW + padX * 2 + 22);
  const h = padY * 2 + lines.length * lineH;
  return { w, h, lines, lineH, padX, padY };
}

function drawAnnotation(a) {
  if (!annotationVisible(a)) return;

  const anchor = annotationAnchor(a);
  const m = measureAnnotation(a);
  let bx = a.bx;
  let by = a.by;
  const bw = m.w;
  const bh = m.h;

  bx = clamp(bx, FIELD.left + 6, FIELD.right - bw - 6);
  by = clamp(by, FIELD.top + 6, FIELD.bottom - bh - 6);

  const edge = edgePointToward(bx, by, bw, bh, anchor.x, anchor.y);

  ctx.save();
  ctx.strokeStyle = "#ff5a00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(edge.x, edge.y);
  ctx.lineTo(anchor.x, anchor.y);
  ctx.stroke();

  const ang = Math.atan2(anchor.y - edge.y, anchor.x - edge.x);
  const ah = 11;
  ctx.fillStyle = "#ff5a00";
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(anchor.x - ah * Math.cos(ang - 0.4), anchor.y - ah * Math.sin(ang - 0.4));
  ctx.lineTo(anchor.x - ah * Math.cos(ang + 0.4), anchor.y - ah * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRectPath(bx, by, bw, bh, 14);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(bx, by, bw, bh, 14);
  ctx.clip();
  ctx.fillStyle = "#ff5a00";
  ctx.fillRect(bx, by, 7, bh);
  ctx.restore();

  ctx.save();
  roundRectPath(bx, by, bw, bh, 14);
  ctx.strokeStyle = "rgba(0,0,0,.14)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#111";
  ctx.font = "700 22px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  m.lines.forEach((l, i) => {
    ctx.fillText(l, bx + m.padX + 6, by + m.padY + i * m.lineH);
  });
  ctx.restore();
}

function drawFooter() {
  const footerTop = H - 92;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, footerTop, W, 92);

  if (!selectedPlay) {
    pixelText("LOAD A PLAY TO BEGIN", W / 2, footerTop + 34, 24, "center", "#ffd700");
    pixelText("Choose a saved play, then connect controllers", W / 2, footerTop + 70, 14, "center", "#fff");
    return;
  }

  const status = simRunning ? "REP LIVE" : "READY";

  pixelText(
    `${status} | PLAYER ${selectedPlayer} | SPEED ${formatSpeed(simSpeedMultiplier)} | SHADOW ${shadowGuideOn ? "ON" : "OFF"}`,
    W / 2,
    footerTop + 34,
    22,
    "center",
    "#ffd700"
  );

  pixelText("Follow shadow movement and confirm timing on controller", W / 2, footerTop + 70, 14, "center", "#fff");
}

function drawCountdown() {
  if (countdownValue === null) return;

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);

  const text = countdownValue === 0 ? "GO!" : String(countdownValue);
  pixelText(text, W / 2, H / 2 + 35, 140, "center", countdownValue === 0 ? "#00ff7f" : "#ffd700");
}

function draw() {
  drawPitch();
  drawPlayNameOverlay();

  if (oppositionEnabled) {
    Object.values(opposition || {}).forEach(drawOppositionPlayer);
  }

  if (shadowGuideOn && expectedPlayers[selectedPlayer]) {
    drawPlayer(expectedPlayers[selectedPlayer], false, true);
  }

  Object.values(players || {}).forEach(p => {
    drawPlayer(p, Number(p.number) === selectedPlayer, false);
  });

  drawBall(ball);

  if (notesGuideOn) {
    (activeNotes || []).forEach(drawAnnotation);
  }

  drawFooter();
  drawCountdown();
}

function notesForStep(step) {
  return Array.isArray(step?.annotations) ? clone(step.annotations) : [];
}

function normalizeStep(step, defaults = {}) {
  const normalizedPitchMode = step?.pitchMode || defaults.pitchMode || "full";
  const normalizedGroup = step?.playerGroup || defaults.playerGroup || defaults.playerView || "all";
  const normalizedSize = step?.playerSize || defaults.playerSize || "small";

  const stepOpposition = step?.opposition || {};
  const normalizedOppEnabled = typeof step?.oppositionEnabled === "boolean"
    ? step.oppositionEnabled
    : Object.keys(stepOpposition).length > 0;

  return {
    ...step,
    pitchMode: normalizedPitchMode,
    playerGroup: normalizedGroup,
    playerSize: normalizedSize,
    players: step?.players || {},
    ball: step?.ball || { x: 820, y: 430 },
    opposition: stepOpposition,
    oppositionEnabled: normalizedOppEnabled,
    oppositionColor: step?.oppositionColor || defaults.oppositionColor || "#1f6feb",
    annotations: Array.isArray(step?.annotations) ? step.annotations : []
  };
}

function loadStep(step, resetExpected = false) {
  if (!step) return;

  const normalized = normalizeStep(step, {
    pitchMode,
    playerGroup,
    playerSize,
    oppositionColor
  });

  pitchMode = normalized.pitchMode || "full";
  playerGroup = normalized.playerGroup || "all";
  playerSize = normalized.playerSize || "small";

  players = clone(normalized.players || {});
  ball = clone(normalized.ball || { x: 820, y: 430 });

  opposition = clone(normalized.opposition || {});
  oppositionEnabled = !!normalized.oppositionEnabled;
  oppositionColor = normalized.oppositionColor || oppositionColor;
  Object.values(opposition).forEach(p => { if (!p.color) p.color = oppositionColor; });

  activeNotes = notesForStep(normalized);

  if (resetExpected) {
    expectedPlayers = clone(normalized.players || {});
  }

  applyActiveField();
  clampAll();
  updateControls();
  updatePitchModeSelect();

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

async function loadPlayablePlays(user) {
  const { data: ownedPlays, error: ownedError } = await supabase
    .from("plays")
    .select(`
      id,
      name,
      created_at,
      play_data,
      folder_id,
      folders (
        id,
        name,
        share_code
      )
    `)
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  if (ownedError) throw ownedError;

  const { data: memberships, error: memberError } = await supabase
    .from("folder_members")
    .select("folder_id")
    .eq("player_id", user.id);

  if (memberError) throw memberError;

  const folderIds = [...new Set((memberships || []).map(m => m.folder_id).filter(Boolean))];

  let sharedPlays = [];

  if (folderIds.length > 0) {
    const { data, error } = await supabase
      .from("plays")
      .select(`
        id,
        name,
        created_at,
        play_data,
        folder_id,
        folders (
          id,
          name,
          share_code
        )
      `)
      .in("folder_id", folderIds)
      .order("created_at", { ascending: false });

    if (error) throw error;
    sharedPlays = data || [];
  }

  const combined = [...(ownedPlays || []), ...sharedPlays];
  const unique = new Map();

  combined.forEach(play => unique.set(play.id, play));

  return Array.from(unique.values());
}

async function openPlayFolder() {
  const user = await getCurrentUser();
  if (!user) return;

  const modal = document.getElementById("playModal");
  const list = document.getElementById("savedPlaysList");

  let plays = [];

  try {
    plays = await loadPlayablePlays(user);
  } catch (error) {
    alert(error.message);
    return;
  }

  list.innerHTML = "";

  if (plays.length === 0) {
    list.innerHTML = `<div class="emptyFolder">📂 No saved plays found.</div>`;
  }

  plays.forEach(play => {
    const item = document.createElement("div");
    item.className = "savedPlayItem";

    const folderName = play.folders?.name || "No folder";
    const playData = play.play_data || {};
    const playSteps = playData.steps || [];
    const groupLabel = playData.playerGroup || playData.playerView || "all";

    item.innerHTML = `
      <div>
        <div class="savedPlayName">📁 ${play.name}</div>
        <div class="savedPlayMeta">
          Folder: ${folderName} | ${playSteps.length} steps | ${playData.pitchMode || "full"} pitch | ${groupLabel}
        </div>
      </div>
      <button data-load="${play.id}">Load</button>
    `;

    list.appendChild(item);
  });

  list.querySelectorAll("[data-load]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.load;
      const play = plays.find(p => p.id === id);

      if (!play) return;

      const playData = play.play_data || {};

      pitchMode = playData.pitchMode || "full";
      playerGroup = playData.playerGroup || playData.playerView || "all";
      playerSize = playData.playerSize || "small";
      oppositionColor = playData.oppositionColor || oppositionColor;

      const loadedSteps = playData.steps || [];

      const normalizedSteps = loadedSteps.map(step =>
        normalizeStep(step, {
          pitchMode,
          playerGroup,
          playerSize,
          oppositionColor
        })
      );

      selectedPlay = {
        id: play.id,
        name: play.name,
        folder_id: play.folder_id || null,
        pitchMode,
        playerGroup,
        playerSize,
        steps: normalizedSteps
      };

      if (selectedPlay.steps[0]) {
        loadStep(selectedPlay.steps[0], true);
      }

      updateControls();
      modal.classList.add("hidden");
      draw();
    };
  });

  modal.classList.remove("hidden");
}

async function saveTrainingLogToDatabase(log) {
  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await supabase.from("training_logs").insert({
    user_id: user.id,
    player_name: user.email,
    player_number: log.player,
    play_name: log.play,
    score: log.score,
    positioning: log.positioning,
    timing: log.timing,
    execution: log.execution,
    distance: log.distance,
    speed: log.speed,
    shadow_guide: log.shadowGuide
  });

  if (error) {
    console.error("Training log save failed:", error);
  }
}

async function saveSimulatorLog(log) {
  const user = await getCurrentUser();
  if (!user || !selectedPlay) return;
  if (!selectedPlay.folder_id) return; // only folder plays are coach-trackable

  const { error } = await supabase.from("simulator_logs").insert({
    user_id: user.id,
    folder_id: selectedPlay.folder_id,
    play_id: selectedPlay.id,
    play_name: selectedPlay.name,
    selected_player: log.player,
    score: log.score,
    completed_at: new Date().toISOString()
  });

  if (error) {
    console.error("Simulator log save failed:", error);
  }
}

// ---------------- Training Log: coach overview vs player own -------------

async function isCoachUser(user) {
  const { data: adminFlag } = await supabase.rpc("is_admin");
  if (adminFlag === true) return true;

  const { count } = await supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", user.id);

  return (count || 0) > 0;
}

async function getCoachLogs() {
  const { data, error } = await supabase.rpc("get_coach_simulator_logs");
  if (error) {
    alert(error.message);
    return [];
  }
  return data || [];
}

async function getOwnTrainingLogs(user) {
  const { data, error } = await supabase
    .from("training_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return [];
  }
  return data || [];
}

function renderCoachLogs(logs) {
  const list = document.getElementById("logsList");
  list.innerHTML = "";

  if (!logs.length) {
    list.innerHTML = `<div class="emptyFolder">No simulator reps logged yet.</div>`;
    return;
  }

  const byPlayer = {};
  for (const log of logs) {
    const key = log.email || log.user_id || "Unknown player";
    if (!byPlayer[key]) byPlayer[key] = { email: key, reps: [] };
    byPlayer[key].reps.push(log);
  }

  const players = Object.values(byPlayer).sort((a, b) => b.reps.length - a.reps.length);

  players.forEach(p => {
    const scores = p.reps.map(r => r.score).filter(s => s !== null && s !== undefined);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "-";
    const playCount = new Set(p.reps.map(r => r.play_name)).size;

    const byPlay = {};
    for (const r of p.reps) {
      const pn = r.play_name || "Unknown play";
      if (!byPlay[pn]) byPlay[pn] = [];
      byPlay[pn].push(r);
    }

    const detail = document.createElement("div");
    detail.style.cssText = "display:none; padding:8px 16px 14px; background:#fafafa;";
    detail.innerHTML = Object.entries(byPlay).map(([playName, reps]) => {
      const repScores = reps.map(r => `${r.score ?? "-"}/10`).join(", ");
      const folderName = reps[0].folder_name ? ` · ${reps[0].folder_name}` : "";
      return `
        <div style="padding:8px 0; border-top:1px solid #eee;">
          <strong>${playName}</strong>${folderName} — done ${reps.length} time(s)<br>
          <span style="color:#555;">Scores: ${repScores}</span>
        </div>`;
    }).join("");

    const card = document.createElement("div");
    card.style.cssText = "margin-bottom:12px; border:1px solid #eee; border-radius:12px; overflow:hidden;";

    const header = document.createElement("div");
    header.style.cssText = "cursor:pointer; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; background:#fff;";
    header.innerHTML = `
      <div>
        <div style="font-weight:700; color:#ff5a1f;">${p.email}</div>
        <div style="color:#555; font-size:0.9em;">${p.reps.length} rep(s) · ${playCount} play(s) · avg ${avg}/10</div>
      </div>
      <div class="logToggle" style="font-size:1.2em; color:#999;">▾</div>`;

    header.onclick = () => {
      const open = detail.style.display === "block";
      detail.style.display = open ? "none" : "block";
      const toggle = header.querySelector(".logToggle");
      if (toggle) toggle.textContent = open ? "▾" : "▴";
    };

    card.appendChild(header);
    card.appendChild(detail);
    list.appendChild(card);
  });
}

function renderPlayerLogs(logs) {
  const list = document.getElementById("logsList");
  list.innerHTML = "";

  if (!logs.length) {
    list.innerHTML = `<div class="emptyFolder">No training logs yet.</div>`;
    return;
  }

  logs.forEach(log => {
    const item = document.createElement("div");
    item.className = "savedPlayItem";
    const date = new Date(log.created_at).toLocaleString();
    item.innerHTML = `
      <div>
        <div class="savedPlayName">${log.play_name || "Unknown play"}</div>
        <div class="savedPlayMeta">
          ${date} | Player ${log.player_number} | Score: ${log.score}/10
        </div>
      </div>`;
    list.appendChild(item);
  });
}

async function openLogs() {
  const modal = document.getElementById("logsModal");
  const user = await getCurrentUser();
  if (!user) return;

  const list = document.getElementById("logsList");
  if (list) list.innerHTML = "Loading...";

  const coach = await isCoachUser(user);

  if (coach) {
    renderCoachLogs(await getCoachLogs());
  } else {
    renderPlayerLogs(await getOwnTrainingLogs(user));
  }

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

  Object.values(expectedPlayers || {}).forEach(p => {
    const a = from.players[p.number];
    const b = to.players[p.number];

    if (!a || !b) return;

    p.x = a.x + (b.x - a.x) * smooth;
    p.y = a.y + (b.y - a.y) * smooth;
    clampPlayer(p);
  });

  Object.values(players || {}).forEach(p => {
    if (p.number === selectedPlayer) return;

    const target = expectedPlayers[p.number];
    if (!target) return;

    p.x = target.x;
    p.y = target.y;
    clampPlayer(p);
  });

  Object.values(opposition || {}).forEach(p => {
    const a = from.opposition?.[p.number];
    const b = to.opposition?.[p.number];

    if (!a || !b) return;

    p.x = a.x + (b.x - a.x) * smooth;
    p.y = a.y + (b.y - a.y) * smooth;
    clampPlayer(p);
  });

  ball.x = from.ball.x + (to.ball.x - from.ball.x) * smooth;
  ball.y = from.ball.y + (to.ball.y - from.ball.y) * smooth;
  clampBall(ball);
}

function animateBetweenSteps(from, to, duration) {
  return new Promise(resolve => {
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);

      interpolateStep(from, to, t);
      draw();

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }

    requestAnimationFrame(frame);
  });
}

async function startSimulation() {
  if (!selectedPlay?.steps || selectedPlay.steps.length < 2) {
    alert("Load a play with at least 2 steps first.");
    return;
  }

  timingClicks = {};
  sessionStartTime = Date.now();

  loadStep(selectedPlay.steps[0], true);

  await countdown();

  simRunning = true;

  const duration = 900 / simSpeedMultiplier;

  for (let i = 1; i < selectedPlay.steps.length; i++) {
    activeNotes = notesForStep(selectedPlay.steps[i]);
    await animateBetweenSteps(selectedPlay.steps[i - 1], selectedPlay.steps[i], duration);
  }

  simRunning = false;
  await calculateScore();
}

async function calculateScore() {
  if (!selectedPlay?.steps?.length) return;

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

  const log = {
    player: selectedPlayer,
    play: selectedPlay?.name || "Unknown Play",
    score: finalScore,
    positioning: positionScore,
    timing: timingScore,
    execution: executionScore,
    distance: Math.round(dist),
    shadowGuide: shadowGuideOn,
    speed: simSpeedMultiplier
  };

  await saveTrainingLogToDatabase(log);
  await saveSimulatorLog(log);

  document.getElementById("scoreResult").innerHTML = `
    <div style="font-size:72px;font-weight:900;color:#ffd700;margin-bottom:25px;">${finalScore}/10</div>
    <div style="font-size:22px;margin-bottom:12px;">Positioning: ${positionScore}/5</div>
    <div style="font-size:22px;margin-bottom:12px;">Timing: ${timingScore}/5</div>
    <div style="font-size:22px;margin-bottom:12px;">Execution: ${executionScore}/5</div>
    <div style="font-size:18px;opacity:.8;margin-top:20px;">Distance from target: ${Math.round(dist)} px</div>
  `;

  document.getElementById("scoreModal").classList.remove("hidden");
}

socket.on("sim-player-move", data => {
  if (!simRunning) return;

  const number = Number(data.number);
  const player = players[number];

  if (!player) return;

  const CONTROLLER_SPEED_BOOST = 1.35;
const movementSpeed = BASE_PLAYER_SPEED * simSpeedMultiplier * CONTROLLER_SPEED_BOOST;

  player.x += Number(data.dx || 0) * movementSpeed;
  player.y += Number(data.dy || 0) * movementSpeed;

  clampPlayer(player);
  draw();
});

socket.on("sim-player-timing", data => {
  timingClicks[Number(data.number)] = Date.now();
});

const loadPlayBtn = document.getElementById("loadPlayBtn");
if (loadPlayBtn) loadPlayBtn.onclick = openPlayFolder;

const qrBtn = document.getElementById("qrBtn");
if (qrBtn) qrBtn.onclick = openQrCodes;

const logsBtn = document.getElementById("logsBtn");
if (logsBtn) logsBtn.onclick = openLogs;

const closeQr = document.getElementById("closeQr");
if (closeQr) closeQr.onclick = () => document.getElementById("qrModal").classList.add("hidden");

const closePlayModal = document.getElementById("closePlayModal");
if (closePlayModal) closePlayModal.onclick = () => document.getElementById("playModal").classList.add("hidden");

const closeScoreModal = document.getElementById("closeScoreModal");
if (closeScoreModal) closeScoreModal.onclick = () => document.getElementById("scoreModal").classList.add("hidden");

const closeLogsModal = document.getElementById("closeLogsModal");
if (closeLogsModal) closeLogsModal.onclick = () => document.getElementById("logsModal").classList.add("hidden");

const playerNumber = document.getElementById("playerNumber");
if (playerNumber) {
  playerNumber.onchange = e => {
    selectedPlayer = Number(e.target.value);
    draw();
  };
}


const startSimBtn = document.getElementById("startSimBtn");
if (startSimBtn) startSimBtn.onclick = startSimulation;

const resetSimBtn = document.getElementById("resetSimBtn");
if (resetSimBtn) {
  resetSimBtn.onclick = () => {
    if (selectedPlay?.steps?.[0]) loadStep(selectedPlay.steps[0], true);

    simRunning = false;
    countdownValue = null;
    timingClicks = {};
    draw();
  };
}

const simSpeed = document.getElementById("simSpeed");
if (simSpeed) {
  simSpeed.oninput = e => {
    simSpeedMultiplier = Number(e.target.value);
    updateControls();
    draw();
  };
}

const shadowGuideToggle = document.getElementById("shadowGuideToggle");
if (shadowGuideToggle) {
  shadowGuideOn = shadowGuideToggle.checked;
  shadowGuideToggle.onchange = e => {
    shadowGuideOn = e.target.checked;
    draw();
  };
}

const notesGuideToggle = document.getElementById("notesGuideToggle");
if (notesGuideToggle) {
  notesGuideOn = notesGuideToggle.checked;
  notesGuideToggle.onchange = e => {
    notesGuideOn = e.target.checked;
    draw();
  };
}

applyActiveField();
updateControls();
updatePitchModeSelect();
draw();

