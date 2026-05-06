const socket = io();
const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

let state = null;
let setupMode = "free";
let playerGroup = "all";
let playerSize = "normal";
let attackDirection = "rtl";
let sportMode = "rugby";
let currentLang = "en";

let draggingBall = false;
let draggingPlayerNumber = null;

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
    rightLeft: "Right → Left",
    leftRight: "Left → Right",
    allPlayers: "All Players",
    forwardsOnly: "Forwards Only",
    backsOnly: "Backs Only",
    normalSize: "Normal Size",
    mediumSize: "2/3 Size",
    smallCircle: "Small Circle",
    freeze: "Freeze",
    reset: "Reset",
    speed: "Speed",
    session: "SESSION LIVE 🔴",
    message1: "Your session is connected.",
    message2: "To keep players connected and continue managing your team:",
    price: "€9.99 / year",
    unlock: "Unlock Access",
    promo: "Promo code:",
    promoPlaceholder: "Enter code",
    applyPromo: "Apply Promo Code",
    invalid: "Invalid promo code.",
    footballMode: "FOOTBALL MODE | SAME PHONE CONTROLLERS",
    attackRTL: "ATTACK: RIGHT → LEFT",
    attackLTR: "ATTACK: LEFT → RIGHT",
    lineoutTopMode: "LINEOUT TOP",
    lineoutBottomMode: "LINEOUT BOTTOM",
    scrumMode: "SCRUM",
    freeBallMode: "FREE BALL MODE",
    footer: "Click/drag player = coach reposition | Click/drag grass = move ball | Double click player = attach ball"
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
    rightLeft: "Droite → Gauche",
    leftRight: "Gauche → Droite",
    allPlayers: "Tous les joueurs",
    forwardsOnly: "Avants seulement",
    backsOnly: "Arrières seulement",
    normalSize: "Taille normale",
    mediumSize: "Taille 2/3",
    smallCircle: "Petit cercle",
    freeze: "Bloquer",
    reset: "Réinitialiser",
    speed: "Vitesse",
    session: "SESSION ACTIVE 🔴",
    message1: "Votre session est connectée.",
    message2: "Pour garder les joueurs connectés et continuer à gérer votre équipe :",
    price: "9,99€ / an",
    unlock: "Débloquer l’accès",
    promo: "Code promo :",
    promoPlaceholder: "Entrer le code",
    applyPromo: "Appliquer le code promo",
    invalid: "Code promo invalide.",
    footballMode: "MODE FOOTBALL | MÊMES CONTRÔLEURS TÉLÉPHONE",
    attackRTL: "ATTAQUE : DROITE → GAUCHE",
    attackLTR: "ATTAQUE : GAUCHE → DROITE",
    lineoutTopMode: "TOUCHE HAUT",
    lineoutBottomMode: "TOUCHE BAS",
    scrumMode: "MÊLÉE",
    freeBallMode: "BALLON LIBRE",
    footer: "Cliquer/glisser joueur = repositionner | Cliquer/glisser terrain = bouger ballon | Double-clic joueur = attacher ballon"
  }
};

function t(key) {
  return TEXT[currentLang][key] || TEXT.en[key] || key;
}

function applyTranslations() {
  document.getElementById("qrBtn").textContent = t("qrCodes");
  document.getElementById("qrTitle").textContent = t("qrTitle");
  document.getElementById("closeQr").textContent = t("close");

  document.querySelector('#sportMode option[value="rugby"]').textContent = t("rugby");
  document.querySelector('#sportMode option[value="football"]').textContent = t("football");

  document.getElementById("lineoutTopBtn").textContent = t("lineoutTop");
  document.getElementById("lineoutBottomBtn").textContent = t("lineoutBottom");
  document.getElementById("scrumBtn").textContent = t("scrum");
  document.getElementById("freeBtn").textContent = t("freeBall");

  document.querySelector('#attackDirection option[value="rtl"]').textContent = t("rightLeft");
  document.querySelector('#attackDirection option[value="ltr"]').textContent = t("leftRight");

  document.querySelector('#playerGroup option[value="all"]').textContent = t("allPlayers");
  document.querySelector('#playerGroup option[value="forwards"]').textContent = t("forwardsOnly");
  document.querySelector('#playerGroup option[value="backs"]').textContent = t("backsOnly");

  document.querySelector('#playerSize option[value="normal"]').textContent = t("normalSize");
  document.querySelector('#playerSize option[value="medium"]').textContent = t("mediumSize");
  document.querySelector('#playerSize option[value="small"]').textContent = t("smallCircle");

  document.getElementById("freezeBtn").textContent = t("freeze");
  document.getElementById("resetBtn").textContent = t("reset");

  const speedLabel = document.querySelector(".speedLabel");
  if (speedLabel) {
    speedLabel.childNodes[0].nodeValue = t("speed") + " ";
  }

  document.getElementById("paywallTitle").textContent = t("session");
  document.getElementById("paywallLine1").textContent = t("message1");
  document.getElementById("paywallLine2").textContent = t("message2");
  document.getElementById("paywallPrice").textContent = t("price");
  document.getElementById("unlockBtn").textContent = t("unlock");
  document.getElementById("promoLabel").textContent = t("promo");
  document.getElementById("promoInput").placeholder = t("promoPlaceholder");
  document.getElementById("promoBtn").textContent = t("applyPromo");
}

function updateToolVisibility() {
  document.querySelectorAll(".rugbyOnly").forEach(item => {
    if (sportMode === "rugby") {
      item.classList.remove("hidden");
    } else {
      item.classList.add("hidden");
    }
  });

  if (sportMode === "football") {
    setupMode = "free";
  }
}

function fitMouse(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

socket.on("state", s => {
  state = s;
  sportMode = state.sportMode || sportMode;
  updateToolVisibility();
  draw();
});

function setMode(mode) {
  setupMode = mode;
  draw();
}

document.getElementById("langToggle").onchange = e => {
  currentLang = e.target.value;
  localStorage.setItem("teamClarityLang", currentLang);
  applyTranslations();
  draw();
};

document.getElementById("sportMode").onchange = e => {
  sportMode = e.target.value;
  updateToolVisibility();
  socket.emit("coach-sport-mode", sportMode);
  draw();
};

document.getElementById("lineoutTopBtn").onclick = () => setMode("lineout-top");
document.getElementById("lineoutBottomBtn").onclick = () => setMode("lineout-bottom");
document.getElementById("scrumBtn").onclick = () => setMode("scrum");
document.getElementById("freeBtn").onclick = () => setMode("free");

document.getElementById("attackDirection").onchange = e => {
  attackDirection = e.target.value;
  socket.emit("coach-attack-direction", attackDirection);
  draw();
};

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

document.getElementById("resetBtn").onclick = () => socket.emit("coach-reset");

document.getElementById("freezeBtn").onclick = () => {
  if (!state) return;
  socket.emit("coach-freeze", !state.frozen);
};

document.getElementById("speed").oninput = e => {
  socket.emit("coach-speed", e.target.value);
};

function shouldShowPlayer(number) {
  if (sportMode === "football" && number > 11) return false;

  if (sportMode === "rugby") {
    if (playerGroup === "all") return true;
    if (playerGroup === "forwards") return number >= 1 && number <= 8;
    if (playerGroup === "backs") return number >= 9 && number <= 15;
  }

  return true;
}

function getClosestPlayerToMouse(mousePoint) {
  if (!state || !state.players) return null;

  let closest = null;
  let bestDistance = 9999;

  for (const player of Object.values(state.players)) {
    if (!shouldShowPlayer(player.number)) continue;

    const distance = Math.hypot(player.x - mousePoint.x, player.y - mousePoint.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      closest = player;
    }
  }

  if (bestDistance < 45) return closest;
  return null;
}

canvas.addEventListener("mousedown", e => {
  const p = fitMouse(e);

  if (sportMode === "rugby") {
    if (setupMode === "lineout-top") {
      socket.emit("coach-setpiece", {
        type: "lineout",
        side: "top",
        x: p.x,
        y: p.y,
        direction: attackDirection
      });
      return;
    }

    if (setupMode === "lineout-bottom") {
      socket.emit("coach-setpiece", {
        type: "lineout",
        side: "bottom",
        x: p.x,
        y: p.y,
        direction: attackDirection
      });
      return;
    }

    if (setupMode === "scrum") {
      socket.emit("coach-setpiece", {
        type: "scrum",
        x: p.x,
        y: p.y,
        direction: attackDirection
      });
      return;
    }
  }

  const player = getClosestPlayerToMouse(p);

  if (player) {
    draggingPlayerNumber = player.number;
    draggingBall = false;

    socket.emit("coach-move-player", {
      number: draggingPlayerNumber,
      x: p.x,
      y: p.y
    });

    return;
  }

  draggingBall = true;
  draggingPlayerNumber = null;
  socket.emit("coach-ball", p);
});

canvas.addEventListener("mousemove", e => {
  const p = fitMouse(e);

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
});

canvas.addEventListener("mouseleave", () => {
  draggingBall = false;
  draggingPlayerNumber = null;
});

canvas.addEventListener("dblclick", e => {
  if (!state) return;

  const p = fitMouse(e);
  const player = getClosestPlayerToMouse(p);

  if (player) {
    socket.emit("coach-attach-ball", player.number);
  }
});

document.getElementById("qrBtn").onclick = async () => {
  const modal = document.getElementById("qrModal");
  modal.classList.remove("hidden");

  const res = await fetch("/api/qrs");
  const data = await res.json();

  const grid = document.getElementById("qrGrid");
  grid.innerHTML = "";

  const maxPlayers = sportMode === "football" ? 11 : 15;

  for (let i = 1; i <= maxPlayers; i++) {
    const item = document.createElement("div");
    item.className = "qrItem";
    item.innerHTML = `
      <div>Player ${i}</div>
      <img src="${data.qrs[i]}">
      <div>${data.baseUrl}/controller.html?p=${i}</div>
    `;
    grid.appendChild(item);
  }
};

document.getElementById("closeQr").onclick = () => {
  document.getElementById("qrModal").classList.add("hidden");
};

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
  if (sportMode === "football") {
    drawFootballPitch();
    return;
  }

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

  ctx.beginPath(); ctx.moveTo(X(0.06), top); ctx.lineTo(X(0.06), bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.94), top); ctx.lineTo(X(0.94), bottom); ctx.stroke();

  ctx.setLineDash([16, 14]);
  ctx.beginPath(); ctx.moveTo(X(0.10), top); ctx.lineTo(X(0.10), bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.90), top); ctx.lineTo(X(0.90), bottom); ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(X(0.26), top); ctx.lineTo(X(0.26), bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.74), top); ctx.lineTo(X(0.74), bottom); ctx.stroke();

  ctx.setLineDash([20, 16]);
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(X(0.40), top); ctx.lineTo(X(0.40), bottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0.60), top); ctx.lineTo(X(0.60), bottom); ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(X(0.50), top); ctx.lineTo(X(0.50), bottom); ctx.stroke();

  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(left, Y(0.08)); ctx.lineTo(right, Y(0.08)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(left, Y(0.92)); ctx.lineTo(right, Y(0.92)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(left, Y(0.23)); ctx.lineTo(right, Y(0.23)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(left, Y(0.77)); ctx.lineTo(right, Y(0.77)); ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px Courier New";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  [["5m", 0.10], ["22m", 0.26], ["40m", 0.40], ["50m", 0.50], ["40m", 0.60], ["22m", 0.74], ["5m", 0.90]].forEach(([label, p]) => {
    ctx.fillText(label, X(p), top - 14);
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

  pixelText(t("slogan"), W / 2, 37, 30, "center", "#fff");

  if (state?.frozen) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, W, H);
    pixelText(t("freeze"), W / 2, H / 2, 90, "center", "#fff");
  }
}

function drawFootballPitch() {
  ctx.fillStyle = "#2f9e44";
  ctx.fillRect(0, 0, W, H);

  const left = 90;
  const right = W - 90;
  const top = 85;
  const bottom = H - 85;
  const midX = W / 2;
  const midY = H / 2;

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.strokeRect(left, top, right - left, bottom - top);

  ctx.beginPath();
  ctx.moveTo(midX, top);
  ctx.lineTo(midX, bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, midY, 95, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(midX, midY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeRect(left, midY - 170, 170, 340);
  ctx.strokeRect(right - 170, midY - 170, 170, 340);

  ctx.strokeRect(left, midY - 80, 65, 160);
  ctx.strokeRect(right - 65, midY - 80, 65, 160);

  ctx.strokeRect(left - 25, midY - 55, 25, 110);
  ctx.strokeRect(right, midY - 55, 25, 110);

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(left + 115, midY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(right - 115, midY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, 60);

  pixelText("TEAM-CLARITY | FOOTBALL MODE", W / 2, 39, 30, "center", "#fff");

  if (state?.frozen) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, W, H);
    pixelText(t("freeze"), W / 2, H / 2, 90, "center", "#fff");
  }
}

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

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(0, 16);
    ctx.moveTo(-16, 0);
    ctx.lineTo(16, 0);
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
  ctx.save();

  const radius = 16;

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 4, radius + 2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.color;
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

function drawPlayer(p) {
  if (!shouldShowPlayer(p.number)) return;

  if (playerSize === "small") {
    drawCirclePlayer(p);
    return;
  }

  ctx.save();
  ctx.translate(p.x, p.y);

  const s = playerSize === "medium" ? 0.37 : 0.55;
  ctx.scale(s, s);

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(-24, 30, 48, 8);

  ctx.fillStyle = p.color;
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

function draw() {
  if (!state) return;

  drawPitch();
  Object.values(state.players).forEach(drawPlayer);
  drawBall(state.ball);

  let modeText = "";

  if (sportMode === "football") {
    modeText = t("footballMode");
  } else {
    modeText = attackDirection === "rtl" ? t("attackRTL") : t("attackLTR");

    if (setupMode === "lineout-top") modeText = `${t("lineoutTopMode")}: ${modeText}`;
    if (setupMode === "lineout-bottom") modeText = `${t("lineoutBottomMode")}: ${modeText}`;
    if (setupMode === "scrum") modeText = `${t("scrumMode")}: ${modeText}`;
    if (setupMode === "free") modeText = `${t("freeBallMode")} | ${modeText}`;
  }

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, H - 82, W, 82);

  pixelText(modeText, W / 2, H - 58, 18, "center", "#ffd700");
  pixelText(t("footer"), W / 2, H - 28, 14, "center", "#ffffff");
}

// ================================
// PAYWALL — COACH SIDE ONLY
// ================================

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/28EeVdesG4TgcBz7D06Vq00";

// Final wait time: 5 minutes
const PAYWALL_WAIT_TIME = 5 * 60 * 1000;

let promoUnlockedThisPageLoad = false;

function hasValidAccess() {
  if (localStorage.getItem("subscriptionActive") === "true") {
    return true;
  }

  return promoUnlockedThisPageLoad === true;
}

function showPaywall() {
  if (hasValidAccess()) return;

  const overlay = document.getElementById("paywallOverlay");
  if (overlay) {
    overlay.classList.remove("hidden");
  }
}

function hidePaywall() {
  const overlay = document.getElementById("paywallOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}

function unlockPromoForThisPageLoadOnly() {
  promoUnlockedThisPageLoad = true;
  hidePaywall();
}

window.addEventListener("load", () => {
  const savedLang = localStorage.getItem("teamClarityLang");

  if (savedLang === "fr" || savedLang === "en") {
    currentLang = savedLang;
    document.getElementById("langToggle").value = currentLang;
  }

  applyTranslations();
  updateToolVisibility();

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
// ================================
// V2 PLAY BUILDER MODE
// ================================
let builderMode = false;
let builderSteps = [];

function togglePlayBuilderMode() {
  builderMode = !builderMode;
  alert(builderMode ? "Play Builder ON" : "Play Builder OFF");
}

function addBuilderStep() {
  if (!state) return;

  builderSteps.push({
    players: JSON.parse(JSON.stringify(state.players)),
    ball: JSON.parse(JSON.stringify(state.ball))
  });

  alert("Step saved: " + builderSteps.length);
}

function clearBuilderSteps() {
  builderSteps = [];
  alert("Play steps cleared");
}

function saveBuilderPlay() {
  const playName = prompt("Play name?", "New Play");
  if (!playName) return;

  localStorage.setItem("teamClarityBuilderPlay", JSON.stringify({
    name: playName,
    steps: builderSteps
  }));

  alert("Play saved: " + playName);
}

function loadBuilderPlay() {
  const saved = localStorage.getItem("teamClarityBuilderPlay");
  if (!saved) {
    alert("No saved play found");
    return;
  }

  const play = JSON.parse(saved);
  builderSteps = play.steps || [];

  alert("Loaded: " + play.name + " | Steps: " + builderSteps.length);
}

function playBuilderSteps() {
  if (!builderSteps || builderSteps.length < 2) {
    alert("Add at least 2 steps first");
    return;
  }

  let i = 0;

  const interval = setInterval(() => {
    const step = builderSteps[i];

    Object.values(step.players).forEach(p => {
      socket.emit("coach-move-player", {
        number: p.number,
        x: p.x,
        y: p.y
      });
    });

    socket.emit("coach-ball", step.ball);

    i++;

    if (i >= builderSteps.length) {
      clearInterval(interval);
    }
  }, 900);
}
