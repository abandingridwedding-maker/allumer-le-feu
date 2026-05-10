const socket = io();

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

let state = null;
let setupMode = "free";
let playerGroup = "all";
let playerSize = "small";
let sportMode = "rugby";
let pitchMode = "full";
let currentLang = "en"; // English only

let draggingBall = false;
let draggingPlayerNumber = null;

const FIELD = {
  left: 70,
  right: W - 70,
  top: 95,
  bottom: H - 145
};

const TEXT = {
  en: {
    slogan: "CLARITY CREATES INTENSITY",
    qrCodes: "QR Codes",
    qrTitle: "Scan to control players",
    close: "Close",
    rugby: "Rugby",
    football: "Football",
    lineoutTop: "Lineout Top",
    lineoutBottom: "Lineout Bottom",
    scrum: "Scrum",
    freeBall: "Free Ball",
    allPlayers: "All Players",
    forwardsOnly: "Forwards Only",
    backsOnly: "Backs Only",
    normalSize: "Normal Size",
    mediumSize: "2/3 Size",
    smallCircle: "Small Circle",
    freeze: "Freeze",
    reset: "Reset",
    speed: "Speed",
    freeBallMode: "FREE BALL MODE",
    lineoutTopMode: "LINEOUT TOP",
    lineoutBottomMode: "LINEOUT BOTTOM",
    scrumMode: "SCRUM",
    footballMode: "FOOTBALL MODE",
    attack: "ATTACK: RIGHT → LEFT",
    footer: "Click player = drag | Click grass = move ball | Double-click player = attach ball",
    session: "SESSION LIVE 🔴",
    message1: "Your session is connected.",
    message2: "To keep players connected and continue managing your team:",
    price: "€9.99 / year",
    unlock: "Unlock Access",
    promo: "Promo code:",
    promoPlaceholder: "Enter code",
    applyPromo: "Apply Promo Code",
    invalid: "Invalid promo code."
  },

  fr: {
    slogan: "LA CLARTÉ CRÉE L’INTENSITÉ",
    qrCodes: "QR Codes",
    qrTitle: "Scanner pour contrôler les joueurs",
    close: "Fermer",
    rugby: "Rugby",
    football: "Football",
    lineoutTop: "Touche haut",
    lineoutBottom: "Touche bas",
    scrum: "Mêlée",
    freeBall: "Ballon libre",
    allPlayers: "Tous les joueurs",
    forwardsOnly: "Avants seulement",
    backsOnly: "Arrières seulement",
    normalSize: "Taille normale",
    mediumSize: "Taille 2/3",
    smallCircle: "Petit cercle",
    freeze: "Bloquer",
    reset: "Réinitialiser",
    speed: "Vitesse",
    freeBallMode: "BALLON LIBRE",
    lineoutTopMode: "TOUCHE HAUT",
    lineoutBottomMode: "TOUCHE BAS",
    scrumMode: "MÊLÉE",
    footballMode: "MODE FOOTBALL",
    attack: "ATTAQUE : DROITE → GAUCHE",
    footer: "Cliquer joueur = glisser | Cliquer terrain = ballon | Double-clic joueur = attacher ballon",
    session: "SESSION ACTIVE 🔴",
    message1: "Votre session est connectée.",
    message2: "Pour garder les joueurs connectés et continuer à gérer votre équipe :",
    price: "9,99€ / an",
    unlock: "Débloquer l’accès",
    promo: "Code promo :",
    promoPlaceholder: "Entrer le code",
    applyPromo: "Appliquer le code promo",
    invalid: "Code promo invalide."
  }
};



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

function setPitchMode(mode, emit = true) {
  pitchMode = ["full", "half", "lineout"].includes(mode) ? mode : "full";

  if (pitchMode === "lineout") {
    playerGroup = "forwards";
    const playerGroupSelect = document.getElementById("playerGroup");
    if (playerGroupSelect) playerGroupSelect.value = "forwards";
  }

  applyActiveField();
  updatePitchModeSelect();
  if (emit) socket.emit("coach-pitch-mode", pitchMode);
  draw();
}

function t(key) {
  return TEXT[currentLang][key] || TEXT.en[key] || key;
}

function safeText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function safeOption(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function setCanvasDragging(isDragging) {
  canvas.classList.toggle("grabbing", isDragging);
}

function applyTranslations() {
  safeText("qrBtn", t("qrCodes"));
  safeText("qrTitle", t("qrTitle"));
  safeText("closeQr", t("close"));

  safeOption('#sportMode option[value="rugby"]', t("rugby"));
  safeOption('#sportMode option[value="football"]', t("football"));

  safeText("lineoutTopBtn", t("lineoutTop"));
  safeText("lineoutBottomBtn", t("lineoutBottom"));
  safeText("scrumBtn", t("scrum"));
  safeText("freeBtn", t("freeBall"));

  safeOption('#playerGroup option[value="all"]', t("allPlayers"));
  safeOption('#playerGroup option[value="forwards"]', t("forwardsOnly"));
  safeOption('#playerGroup option[value="backs"]', t("backsOnly"));

  safeOption('#playerSize option[value="normal"]', t("normalSize"));
  safeOption('#playerSize option[value="medium"]', t("mediumSize"));
  safeOption('#playerSize option[value="small"]', t("smallCircle"));

  safeText("freezeBtn", t("freeze"));
  safeText("resetBtn", t("reset"));

  const speedLabel = document.querySelector(".speedLabel");
  if (speedLabel && speedLabel.childNodes[0]) {
    speedLabel.childNodes[0].nodeValue = t("speed") + " ";
  }

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

/* ================================
   ACTIVE BUTTONS
================================ */

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

function updateToolVisibility() {
  document.querySelectorAll(".rugbyOnly").forEach(item => {
    item.classList.toggle("hidden", sportMode !== "rugby");
  });

  if (sportMode === "football") setupMode = "free";

  updateModeButtons();
}

/* ================================
   SOCKET STATE
================================ */

socket.on("state", serverState => {
  state = serverState;

  if (state.sportMode) sportMode = state.sportMode;
  if (state.pitchMode) pitchMode = state.pitchMode;

  applyActiveField();
  updatePitchModeSelect();
  updateToolVisibility();
  draw();
});

/* ================================
   DOM CONTROLS
================================ */

const langToggle = document.getElementById("langToggle");
if (langToggle) {
  langToggle.onchange = e => {
    currentLang = e.target.value;
    localStorage.setItem("teamClarityLang", currentLang);
    applyTranslations();
    draw();
  };
}

document.getElementById("pitchMode").onchange = e => setPitchMode(e.target.value);


document.getElementById("sportMode").onchange = e => {
  sportMode = e.target.value;
  socket.emit("coach-sport-mode", sportMode);
  updateToolVisibility();
  draw();
};

document.getElementById("lineoutTopBtn").onclick = () => setMode("lineout-top");
document.getElementById("lineoutBottomBtn").onclick = () => setMode("lineout-bottom");
document.getElementById("scrumBtn").onclick = () => setMode("scrum");
document.getElementById("freeBtn").onclick = () => setMode("free");

document.getElementById("teamColor").onchange = e => {
  socket.emit("coach-team-color", e.target.value);
};

document.getElementById("playerGroup").onchange = e => {
  playerGroup = e.target.value;
  draw();
};

document.getElementById("playerSize").onchange = e => {
  playerSize = e.target.value;
  draw();
};

document.getElementById("resetBtn").onclick = () => {
  socket.emit("coach-reset");
  setMode("free");
};

document.getElementById("freezeBtn").onclick = () => {
  if (!state) return;
  socket.emit("coach-freeze", !state.frozen);
};

document.getElementById("speed").oninput = e => {
  socket.emit("coach-speed", Number(e.target.value));
};

/* ================================
   MOUSE / TOUCH GEOMETRY
================================ */

function mousePoint(e) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function shouldShowPlayer(number) {
  if (sportMode === "football" && number > 11) return false;

  if (sportMode === "rugby") {
    if (playerGroup === "all") return true;
    if (playerGroup === "forwards") return number >= 1 && number <= 8;
    if (playerGroup === "backs") return number >= 9 && number <= 15;
  }

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

/* ================================
   CANVAS INTERACTION
================================ */

canvas.addEventListener("mousedown", e => {
  const p = mousePoint(e);

  if (sportMode === "rugby" && setupMode === "lineout-top") {
    socket.emit("coach-setpiece", {
      type: "lineout",
      side: "top",
      x: p.x,
      y: p.y
    });

    setMode("free");
    return;
  }

  if (sportMode === "rugby" && setupMode === "lineout-bottom") {
    socket.emit("coach-setpiece", {
      type: "lineout",
      side: "bottom",
      x: p.x,
      y: p.y
    });

    setMode("free");
    return;
  }

  if (sportMode === "rugby" && setupMode === "scrum") {
    socket.emit("coach-setpiece", {
      type: "scrum",
      x: p.x,
      y: p.y
    });

    setMode("free");
    return;
  }

  if (isBallHit(p)) {
    draggingBall = true;
    draggingPlayerNumber = null;
    socket.emit("coach-ball", p);
    setCanvasDragging(true);
    return;
  }

  const player = getClosestPlayer(p);

  if (player) {
    draggingPlayerNumber = player.number;
    draggingBall = false;

    socket.emit("coach-move-player", {
      number: player.number,
      x: p.x,
      y: p.y
    });

    setCanvasDragging(true);
    return;
  }

  draggingBall = true;
  draggingPlayerNumber = null;
  socket.emit("coach-ball", p);
  setCanvasDragging(true);
});

canvas.addEventListener("mousemove", e => {
  const p = mousePoint(e);

  if (draggingPlayerNumber) {
    socket.emit("coach-move-player", {
      number: draggingPlayerNumber,
      x: p.x,
      y: p.y
    });
    return;
  }

  if (draggingBall) {
    socket.emit("coach-ball", p);
  }
});

canvas.addEventListener("mouseup", () => {
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
  const p = mousePoint(e);
  const player = getClosestPlayer(p);

  if (player) socket.emit("coach-attach-ball", player.number);
});

/* ================================
   QR MODAL
================================ */

document.getElementById("qrBtn").onclick = async () => {
  const modal = document.getElementById("qrModal");
  const grid = document.getElementById("qrGrid");

  modal.classList.remove("hidden");
  grid.innerHTML = "";

  const res = await fetch("/api/qrs");
  const data = await res.json();

  const maxPlayers = sportMode === "football" ? 11 : 15;

  for (let i = 1; i <= maxPlayers; i++) {
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

document.getElementById("closeQr").onclick = () => {
  document.getElementById("qrModal").classList.add("hidden");
};

/* ================================
   DRAW HELPERS
================================ */

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

/* ================================
   FIELD
================================ */

function drawPitchHeader(title) {
  ctx.fillStyle = "#d71920";
  ctx.fillRect(0, 0, W, 52);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 52, W, 8);
  pixelText(title, W / 2, 37, 30, "center", "#fff");
}

function drawRugbyPitch() {
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

  drawFullRugbyPitch();
}

function drawFullRugbyPitch() {
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

  drawPitchHeader(t("slogan"));
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
  drawPitchHeader(t("slogan") + " | HALF PITCH");
}

function drawLineoutPitch() {
  ctx.fillStyle = "#6ec65f";
  ctx.fillRect(0, 0, W, H);

  const { left, right, top, bottom } = FIELD;
  const pw = right - left;
  const ph = bottom - top;

  // Lineout pitch calibration: visible area = touchline to 15m line + 2m free space.
  // 5m line = 5/17 across; 15m line = 15/17 across.
  const X = metres => left + pw * (metres / 17);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.strokeRect(left, top, pw, ph);

  // Touchline = solid left edge.
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
    pixelText(label, X(metres), bottom + 34, 20, "center", "#fff");
  });

  ctx.setLineDash([]);

  pixelText("5m", X(5), top + 34, 20, "center", "#fff");
  pixelText("15m", X(15), top + 34, 20, "center", "#fff");

  drawPitchHeader(t("slogan") + " | LINEOUT");
}
function drawFootballPitch() {
  ctx.fillStyle = "#2f9e44";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, 60);

  pixelText("TEAM-CLARITY | FOOTBALL MODE", W / 2, 39, 30, "center", "#fff");
}

/* ================================
   BALL / PLAYERS
================================ */

function drawBall(ball) {
  ctx.save();
  ctx.translate(ball.x, ball.y);

  if (sportMode === "football") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    return;
  }

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

  ctx.fillStyle = p.connected ? "#00ff7f" : "#ffdf4d";
  ctx.beginPath();
  ctx.arc(p.x + 18, p.y - 30, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(p) {
  if (!shouldShowPlayer(p.number)) return;

  if (playerSize === "small") {
    drawCirclePlayer(p);
    return;
  }

  drawPixelPlayer(p);
}

/* ================================
   MAIN DRAW
================================ */

function drawFooter() {
  const footerTop = H - 72;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, footerTop, W, 72);

  let modeText = "";

  if (sportMode === "football") {
    modeText = t("footballMode");
  } else if (setupMode === "lineout-top") {
    modeText = `${t("lineoutTopMode")} | CLICK FIELD TO PLACE`;
  } else if (setupMode === "lineout-bottom") {
    modeText = `${t("lineoutBottomMode")} | CLICK FIELD TO PLACE`;
  } else if (setupMode === "scrum") {
    modeText = `${t("scrumMode")} | CLICK FIELD TO PLACE`;
  } else {
    modeText = `${t("freeBallMode")} | ${t("attack")} | ${pitchMode.toUpperCase()} PITCH`;
  }

  pixelText(modeText, W / 2, footerTop + 28, 18, "center", "#ffd700");
  pixelText(t("footer"), W / 2, footerTop + 54, 13, "center", "#ffffff");
}

function draw() {
  if (!state) return;

  if (sportMode === "football") {
    drawFootballPitch();
  } else {
    drawRugbyPitch();
  }

  Object.values(state.players).forEach(drawPlayer);
  drawBall(state.ball);

  if (state.frozen) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, W, H);
    pixelText(t("freeze"), W / 2, H / 2, 90, "center", "#fff");
  }

  drawFooter();
}

/* ================================
   PAYWALL
================================ */

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

/* ================================
   STARTUP
================================ */

window.addEventListener("load", () => {
  const savedLang = localStorage.getItem("teamClarityLang");

  if (savedLang === "fr" || savedLang === "en") {
    currentLang = "en";
    const langToggle = document.getElementById("langToggle");
    if (langToggle) langToggle.value = currentLang;
  }

  applyTranslations();
  applyActiveField();
  updatePitchModeSelect();
  updateToolVisibility();
  updateModeButtons();

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
