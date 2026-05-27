import { supabase } from "./supabase.js";

const mobileHome = document.querySelector(".mobileSimHome");
const mobileSimulatorScreen = document.getElementById("mobileSimulatorScreen");

const loadMobilePlayBtn = document.getElementById("loadMobilePlayBtn");
const mobilePlayCode = document.getElementById("mobilePlayCode");

const mobilePitch = document.getElementById("mobilePitch");
const ctx = mobilePitch.getContext("2d");

const mobilePlayerButtons = document.getElementById("mobilePlayerButtons");
const mobileScoreText = document.getElementById("mobileScoreText");
const mobilePlayName = document.getElementById("mobilePlayName");

const backToMobileHome = document.getElementById("backToMobileHome");
const mobilePlayBtn = document.getElementById("mobilePlayBtn");
const mobileResetBtn = document.getElementById("mobileResetBtn");

const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileControlOverlay = document.getElementById("mobileControlOverlay");
const closeMobileControlOverlay = document.getElementById("closeMobileControlOverlay");

const mobilePanelPlayName = document.getElementById("mobilePanelPlayName");
const mobilePanelScoreText = document.getElementById("mobilePanelScoreText");

const pitchImages = {
  full: new Image(),
  half: new Image(),
  lineout: new Image()
};

pitchImages.full.src = "assets/rugby-pitch.png";
pitchImages.half.src = "assets/half-pitch.png";
pitchImages.lineout.src = "assets/lineout-pitch.png";

const ballImage = new Image();
ballImage.src = "assets/tc-ball.png";

const FIELD = {
  left: 70,
  right: 1130,
  top: 85,
  bottom: 615
};

let folder = null;
let plays = [];
let currentPlay = null;
let steps = [];
let currentStepIndex = 0;
let pitchMode = "full";

let selectedPlayer = null;
let players = {};
let idealPlayers = {};
let ball = { x: 300, y: 300 };
let idealBall = { x: 300, y: 300 };

let score = 0;
let isDragging = false;
let animationRunning = false;
let renderStarted = false;

let shadowOn = true;
let viewMode = "behind";
let repSpeed = 1;

let cameraY = 0;
let targetCameraY = 0;
let cameraZoom = 1;
let targetCameraZoom = 1;
let cameraCenterY = 350;
let targetCameraCenterY = 350;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function clampPlayer(player) {
  if (!player) return;
  player.x = clamp(player.x, FIELD.left, FIELD.right);
  player.y = clamp(player.y, FIELD.top, FIELD.bottom);
}

function clampBallObject(b) {
  if (!b) return;
  b.x = clamp(b.x, FIELD.left, FIELD.right);
  b.y = clamp(b.y, FIELD.top, FIELD.bottom);
}

function clampAll() {
  Object.values(players || {}).forEach(clampPlayer);
  Object.values(idealPlayers || {}).forEach(clampPlayer);
  clampBallObject(ball);
  clampBallObject(idealBall);
}

function normalizeStepsToMobileField(rawSteps) {
  const cloned = clone(rawSteps || []);

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  cloned.forEach(step => {
    Object.values(step.players || {}).forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    if (step.ball) {
      minX = Math.min(minX, step.ball.x);
      maxX = Math.max(maxX, step.ball.x);
      minY = Math.min(minY, step.ball.y);
      maxY = Math.max(maxY, step.ball.y);
    }
  });

  if (!isFinite(minX) || !isFinite(minY)) return cloned;

  const sourceW = Math.max(1, maxX - minX);
  const sourceH = Math.max(1, maxY - minY);

  const targetW = FIELD.right - FIELD.left;
  const targetH = FIELD.bottom - FIELD.top;

  const scale = Math.min(1, targetW / sourceW, targetH / sourceH);

  const sourceCX = (minX + maxX) / 2;
  const targetCX = (FIELD.left + FIELD.right) / 2;

  // Anchor bottom of the play to the bottom touchline area.
  cloned.forEach(step => {
    Object.values(step.players || {}).forEach(p => {
      p.x = targetCX + (p.x - sourceCX) * scale;
      p.y = FIELD.bottom - (maxY - p.y) * scale;
      clampPlayer(p);
    });

    if (step.ball) {
      step.ball.x = targetCX + (step.ball.x - sourceCX) * scale;
      step.ball.y = FIELD.bottom - (maxY - step.ball.y) * scale;
      clampBallObject(step.ball);
    }
  });

  return cloned;
}

function resizeCanvas() {
  const rect = mobilePitch.getBoundingClientRect();
  mobilePitch.width = Math.max(320, Math.floor(rect.width || window.innerWidth));
  mobilePitch.height = Math.max(220, Math.floor(rect.height || window.innerHeight));
  updateCameraTarget(true);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

loadMobilePlayBtn.onclick = joinTeamFolder;

mobilePlayCode.addEventListener("keydown", e => {
  if (e.key === "Enter") joinTeamFolder();
});

mobileMenuToggle.onclick = () => {
  mobileControlOverlay.classList.remove("hidden");
};

closeMobileControlOverlay.onclick = () => {
  mobileControlOverlay.classList.add("hidden");
};

ensureMobileToggles();

function ensureMobileToggles() {
  const panel = document.querySelector(".mobileControlPanel");
  if (!panel || document.getElementById("mobileShadowToggle")) return;

  const shadowToggle = document.createElement("button");
  shadowToggle.id = "mobileShadowToggle";
  shadowToggle.type = "button";
  shadowToggle.textContent = "Shadow: ON";
  shadowToggle.onclick = () => {
    shadowOn = !shadowOn;
    shadowToggle.textContent = shadowOn ? "Shadow: ON" : "Shadow: OFF";
  };

  const viewToggle = document.createElement("button");
  viewToggle.id = "mobileViewToggle";
  viewToggle.type = "button";
  viewToggle.textContent = "View: Behind";
  viewToggle.onclick = () => {
    viewMode = viewMode === "behind" ? "overview" : "behind";
    viewToggle.textContent = viewMode === "behind" ? "View: Behind" : "View: Full";
    updateCameraTarget(true);
  };

  const speedToggle = document.createElement("button");
  speedToggle.id = "mobileSpeedToggle";
  speedToggle.type = "button";
  speedToggle.textContent = "Speed: 1x";
  speedToggle.onclick = () => {
    if (repSpeed === 0.5) repSpeed = 0.75;
    else if (repSpeed === 0.75) repSpeed = 1;
    else if (repSpeed === 1) repSpeed = 1.25;
    else repSpeed = 0.5;

    speedToggle.textContent = `Speed: ${repSpeed}x`;
  };

  const resetBtn = document.getElementById("mobileResetBtn");
  panel.insertBefore(shadowToggle, resetBtn.nextSibling);
  panel.insertBefore(viewToggle, shadowToggle.nextSibling);
  panel.insertBefore(speedToggle, viewToggle.nextSibling);
}

async function joinTeamFolder() {
  const code = mobilePlayCode.value.trim();

  if (!code) {
    alert("Enter a folder code.");
    return;
  }

  loadMobilePlayBtn.disabled = true;
  loadMobilePlayBtn.textContent = "Joining...";

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    alert("Please log in first to join this folder.");
    localStorage.setItem("pending_mobile_folder_code", code);
    window.location.href = "auth.html";
    return;
  }

  const { data: foundFolder, error: folderError } = await supabase
    .from("folders")
    .select("id, name, share_code")
    .ilike("share_code", code)
    .limit(1)
    .maybeSingle();

  if (folderError || !foundFolder) {
    alert("Folder not found.");
    loadMobilePlayBtn.disabled = false;
    loadMobilePlayBtn.textContent = "Join Folder";
    return;
  }

  folder = foundFolder;

  const { error: memberError } = await supabase
    .from("folder_members")
    .insert({
      folder_id: folder.id,
      player_id: user.id
    });

  if (memberError && memberError.code !== "23505") {
    alert(memberError.message || "Could not join folder.");
    loadMobilePlayBtn.disabled = false;
    loadMobilePlayBtn.textContent = "Join Folder";
    return;
  }

  const { data: folderPlays, error: playsError } = await supabase
    .from("plays")
    .select("id, name, play_data, created_at")
    .eq("folder_id", folder.id)
    .order("created_at", { ascending: false });

  if (playsError) {
    alert(playsError.message);
    loadMobilePlayBtn.disabled = false;
    loadMobilePlayBtn.textContent = "Join Folder";
    return;
  }

  plays = folderPlays || [];

  if (!plays.length) {
    alert("This folder has no plays yet.");
    loadMobilePlayBtn.disabled = false;
    loadMobilePlayBtn.textContent = "Join Folder";
    return;
  }

  showPlaySelection();
}

function showPlaySelection() {
  mobileHome.innerHTML = `
    <img src="assets/tc-logo.png" class="mobileSimLogo" alt="TEAM-CLARITY" />
    <section class="mobileSimCard">
      <div class="mobileSimIcon">📁</div>
      <h1>${folder.name}</h1>
      <p>Select a play to train.</p>
    </section>
    <section class="mobileCodeCard">
      <div id="mobilePlayList"></div>
    </section>
  `;

  const list = document.getElementById("mobilePlayList");

  plays.forEach(play => {
    const btn = document.createElement("button");
    btn.className = "mobilePlayChoiceBtn";
    btn.textContent = play.name;
    btn.onclick = () => openPlay(play);
    list.appendChild(btn);
  });
}

function openPlay(play) {
  currentPlay = play;

  const data = play.play_data || {};
  steps = normalizeStepsToMobileField(data.steps || []);
  pitchMode = data.pitchMode || "full";
  currentStepIndex = 0;

  if (!steps.length) {
    alert("This play has no steps.");
    return;
  }

  applyStep(steps[0]);

  mobileHome.classList.add("hidden");
  mobileSimulatorScreen.classList.remove("hidden");
  document.body.classList.add("simulatorActive");

  mobileControlOverlay.classList.add("hidden");

  if (mobilePlayName) mobilePlayName.textContent = play.name;
  if (mobilePanelPlayName) mobilePanelPlayName.textContent = play.name;

  score = 0;
  updateScore();
  resizeCanvas();

  if (!renderStarted) {
    renderStarted = true;
    render();
  }
}

function applyStep(step) {
  players = clone(step.players || {});
  idealPlayers = clone(step.players || {});
  ball = clone(step.ball || { x: 300, y: 300 });
  idealBall = clone(step.ball || { x: 300, y: 300 });
  clampAll();
}

function buildPlayerButtons() {
  mobilePlayerButtons.innerHTML = "";

  for (let i = 1; i <= 15; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    btn.className = "mobilePlayerBtn";

    btn.onclick = () => {
      selectedPlayer = i;

      document.querySelectorAll(".mobilePlayerBtn").forEach(b => {
        b.classList.remove("activeMobilePlayer");
        b.classList.remove("active");
      });

      btn.classList.add("activeMobilePlayer");
      btn.classList.add("active");

      updateCameraTarget(true);
      mobileControlOverlay.classList.add("hidden");
    };

    mobilePlayerButtons.appendChild(btn);
  }
}

buildPlayerButtons();

function getBehindBaseScale() {
  return (mobilePitch.width / 700) * 0.78;
}

function getIdealTargetForSelected() {
  if (!selectedPlayer || !steps.length) return null;

  const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1);
  return steps[nextIndex]?.players?.[selectedPlayer] || null;
}

function getGuideForSelected() {
  if (!selectedPlayer) return null;
  return idealPlayers?.[selectedPlayer] || getIdealTargetForSelected();
}

function getActiveBounds() {
  const points = [];

  Object.values(players || {}).forEach(p => points.push(p));
  Object.values(idealPlayers || {}).forEach(p => points.push(p));
  if (ball) points.push(ball);
  if (idealBall) points.push(idealBall);

  const guide = getGuideForSelected();
  if (guide) points.push(guide);

  if (!points.length) {
    return { minX: FIELD.left, maxX: FIELD.right, minY: FIELD.top, maxY: FIELD.bottom };
  }

  return {
    minX: Math.min(...points.map(p => p.x)),
    maxX: Math.max(...points.map(p => p.x)),
    minY: Math.min(...points.map(p => p.y)),
    maxY: Math.max(...points.map(p => p.y))
  };
}

function getSmartZoom() {
  if (viewMode !== "behind") return 1;

  const player = players[selectedPlayer];
  const target = getGuideForSelected();

  let desiredZoom = 1;

  if (player && target) {
    const distance = Math.hypot(player.x - target.x, player.y - target.y);

    if (distance < 35) desiredZoom = 1.22;
    else if (distance < 80) desiredZoom = 1.12;
    else if (distance < 140) desiredZoom = 1.02;
    else if (distance < 220) desiredZoom = 0.92;
    else desiredZoom = 0.82;
  }

  const bounds = getActiveBounds();
  const lateralSpan = Math.max(1, bounds.maxY - bounds.minY);
  const allowedWidth = mobilePitch.width * 0.72;
  const baseScale = getBehindBaseScale();
  const maxZoomToFitWidth = allowedWidth / lateralSpan / baseScale;

  return clamp(Math.min(desiredZoom, maxZoomToFitWidth), 0.68, 1.22);
}

function getOverviewRect() {
  const padX = 24;
  const padTop = 12;
  const padBottom = 55;

  return {
    x: padX,
    y: padTop,
    w: mobilePitch.width - padX * 2,
    h: mobilePitch.height - padTop - padBottom
  };
}

function toScreen(point) {
  if (viewMode === "behind") {
    const s = getBehindBaseScale() * cameraZoom;

    return {
      x: mobilePitch.width / 2 + (cameraCenterY - point.y) * s,
      y: point.x * s + cameraY
    };
  }

  const r = getOverviewRect();

  return {
    x: r.x + (point.x / 1200) * r.w,
    y: r.y + (point.y / 700) * r.h
  };
}

function toField(screenX, screenY) {
  if (viewMode === "behind") {
    const s = getBehindBaseScale() * cameraZoom;

    return {
      x: (screenY - cameraY) / s,
      y: cameraCenterY - ((screenX - mobilePitch.width / 2) / s)
    };
  }

  const r = getOverviewRect();

  return {
    x: ((screenX - r.x) / r.w) * 1200,
    y: ((screenY - r.y) / r.h) * 700
  };
}

function updateCameraTarget(snap = false) {
  if (viewMode !== "behind" || !selectedPlayer || !players[selectedPlayer]) {
    targetCameraY = 0;
    targetCameraZoom = 1;
    targetCameraCenterY = 350;

    if (snap) {
      cameraY = 0;
      cameraZoom = 1;
      cameraCenterY = 350;
    }

    return;
  }

  const player = players[selectedPlayer];
  const guide = getGuideForSelected();
  const bounds = getActiveBounds();

  let focusX = player.x;
  let focusY = player.y;

  if (guide) {
    focusX = (player.x + guide.x) / 2;
    focusY = (player.y + guide.y) / 2;
  }

  const boundsCenterY = (bounds.minY + bounds.maxY) / 2;

  targetCameraCenterY = (focusY * 0.55) + (boundsCenterY * 0.45);
  targetCameraCenterY = clamp(targetCameraCenterY, FIELD.top, FIELD.bottom);

  targetCameraZoom = getSmartZoom();

  const s = getBehindBaseScale() * targetCameraZoom;

  targetCameraY = mobilePitch.height / 2 - focusX * s;

  const pitchHeight = 1200 * s;
  const minY = mobilePitch.height - pitchHeight;
  const maxY = 0;

  targetCameraY = clamp(targetCameraY, minY, maxY);

  if (snap) {
    cameraY = targetCameraY;
    cameraZoom = targetCameraZoom;
    cameraCenterY = targetCameraCenterY;
  }
}

function render() {
  ctx.clearRect(0, 0, mobilePitch.width, mobilePitch.height);

  updateCameraTarget(false);

  cameraY += (targetCameraY - cameraY) * 0.08;
  cameraZoom += (targetCameraZoom - cameraZoom) * 0.08;
  cameraCenterY += (targetCameraCenterY - cameraCenterY) * 0.08;

  drawPitch();

  if (shadowOn) drawGuideShadow();

  drawPlayers();
  drawBall();

  requestAnimationFrame(render);
}

function drawPitch() {
  const img = pitchImages[pitchMode] || pitchImages.full;

  if (!(img.complete && img.naturalWidth > 0)) {
    ctx.fillStyle = "#15651c";
    ctx.fillRect(0, 0, mobilePitch.width, mobilePitch.height);
    return;
  }

  if (viewMode === "behind") {
    const s = getBehindBaseScale() * cameraZoom;

    ctx.save();
    ctx.translate(mobilePitch.width / 2 + cameraCenterY * s, cameraY);
    ctx.scale(s, s);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0, 1200, 700);
    ctx.restore();
    return;
  }

  const r = getOverviewRect();
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
}

function drawGuideShadow() {
  if (!selectedPlayer || !steps.length) return;

  const guide = getGuideForSelected();
  if (!guide) return;

  const p = toScreen(guide);

  ctx.save();

  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#ffd400";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#111";
  ctx.font = "900 11px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(selectedPlayer, p.x, p.y);

  ctx.restore();
}

function drawPlayers() {
  Object.values(players || {}).forEach(player => {
    const p = toScreen(player);
    const isSelected = Number(player.number) === Number(selectedPlayer);
    const radius = isSelected ? 15 : 8.5;

    ctx.save();

    ctx.fillStyle = isSelected ? "#ffd400" : player.color || "#d71920";
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = isSelected ? 4 : 2.5;
    ctx.stroke();

    ctx.fillStyle = isSelected ? "#111" : "#ffffff";
    ctx.font = isSelected ? "900 11px Arial" : "900 8px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.number, p.x, p.y);

    ctx.restore();
  });
}

function drawBall() {
  if (!ball) return;

  const p = toScreen(ball);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-0.35);

  if (ballImage.complete && ballImage.naturalWidth > 0) {
    ctx.drawImage(ballImage, -18, -10, 36, 20);
  } else {
    ctx.fillStyle = "#ff5a1f";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

mobilePitch.addEventListener("touchstart", startDrag, { passive: false });
mobilePitch.addEventListener("touchmove", dragPlayer, { passive: false });
mobilePitch.addEventListener("touchend", endDrag);

function startDrag(e) {
  if (!selectedPlayer) return;
  isDragging = true;
  moveSelectedPlayer(e);
}

function dragPlayer(e) {
  if (!isDragging) return;
  moveSelectedPlayer(e);
}

function endDrag() {
  isDragging = false;
  calculateScore(false);
}

function moveSelectedPlayer(e) {
  e.preventDefault();

  const touch = e.touches[0];
  const rect = mobilePitch.getBoundingClientRect();

  const fieldPoint = toField(
    touch.clientX - rect.left,
    touch.clientY - rect.top
  );

  const player = players[selectedPlayer];

  if (!player) return;

  player.x = fieldPoint.x;
  player.y = fieldPoint.y;

  clampPlayer(player);
  updateCameraTarget(false);
}

mobilePlayBtn.onclick = async () => {
  mobileControlOverlay.classList.add("hidden");

  if (animationRunning || steps.length < 2) return;

  await showCountdown();

  animationRunning = true;

  for (let i = 1; i < steps.length; i++) {
    await animateToStep(steps[i], 900 / repSpeed);
    currentStepIndex = i;
  }

  animationRunning = false;

  calculateScore(true);
};

mobileResetBtn.onclick = () => {
  currentStepIndex = 0;
  applyStep(steps[0]);
  score = 0;
  updateScore();
  updateCameraTarget(true);
  mobileControlOverlay.classList.add("hidden");
};

backToMobileHome.onclick = () => {
  mobileSimulatorScreen.classList.add("hidden");
  mobileHome.classList.remove("hidden");
  mobileControlOverlay.classList.add("hidden");
  document.body.classList.remove("simulatorActive");
};

function animateToStep(targetStep, duration = 900) {
  return new Promise(resolve => {
    const startPlayers = clone(players);
    const startIdealPlayers = clone(idealPlayers);
    const startBall = clone(ball);
    const startIdealBall = clone(idealBall);

    const targetPlayers = targetStep.players || {};
    const targetBall = targetStep.ball || ball;

    const startTime = performance.now();

    function frame(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const smooth = t * t * (3 - 2 * t);

      Object.values(players).forEach(player => {
        const a = startPlayers[player.number];
        const b = targetPlayers[player.number];

        if (!a || !b) return;

        if (Number(player.number) === Number(selectedPlayer)) return;

        player.x = a.x + (b.x - a.x) * smooth;
        player.y = a.y + (b.y - a.y) * smooth;
        clampPlayer(player);
      });

      Object.values(idealPlayers).forEach(player => {
        const a = startIdealPlayers[player.number];
        const b = targetPlayers[player.number];

        if (!a || !b) return;

        player.x = a.x + (b.x - a.x) * smooth;
        player.y = a.y + (b.y - a.y) * smooth;
        clampPlayer(player);
      });

      ball.x = startBall.x + (targetBall.x - startBall.x) * smooth;
      ball.y = startBall.y + (targetBall.y - startBall.y) * smooth;
      clampBallObject(ball);

      idealBall.x = startIdealBall.x + (targetBall.x - startIdealBall.x) * smooth;
      idealBall.y = startIdealBall.y + (targetBall.y - startIdealBall.y) * smooth;
      clampBallObject(idealBall);

      updateCameraTarget(false);

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }

    requestAnimationFrame(frame);
  });
}

function calculateScore(showPopup) {
  if (!selectedPlayer || !steps[currentStepIndex]) return;

  const target = steps[currentStepIndex].players?.[selectedPlayer];
  const player = players[selectedPlayer];

  if (!target || !player) return;

  const distance = Math.hypot(player.x - target.x, player.y - target.y);

  if (distance < 25) score = 10;
  else if (distance < 50) score = 8;
  else if (distance < 90) score = 6;
  else if (distance < 140) score = 4;
  else score = 2;

  updateScore();

  if (showPopup) showScorePopup(score);
}

function updateScore() {
  if (mobileScoreText) mobileScoreText.innerText = `Score: ${score}/10`;
  if (mobilePanelScoreText) mobilePanelScoreText.innerText = `Score: ${score}/10`;
}

function showCountdown() {
  return new Promise(resolve => {
    let count = 3;

    const overlay = document.createElement("div");
    overlay.className = "mobileCountdownOverlay";
    overlay.textContent = count;

    document.body.appendChild(overlay);

    const interval = setInterval(() => {
      count--;

      if (count > 0) {
        overlay.textContent = count;
      } else if (count === 0) {
        overlay.textContent = "GO";
      } else {
        clearInterval(interval);
        overlay.remove();
        resolve();
      }
    }, 700);
  });
}

function showScorePopup(value) {
  const popup = document.createElement("div");
  popup.className = "mobileScorePopup";
  popup.innerHTML = `
    <div class="mobileScorePopupCard">
      <div class="mobileScorePopupTitle">REP SCORE</div>
      <div class="mobileScorePopupValue">${value}/10</div>
      <button id="closeMobileScorePopup">OK</button>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("closeMobileScorePopup").onclick = () => {
    popup.remove();
  };

  setTimeout(() => {
    if (document.body.contains(popup)) popup.remove();
  }, 2500);
}