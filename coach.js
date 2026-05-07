/* TEAM-CLARITY V2 - coach.js */

(function () {
  "use strict";

  const socket = window.socket || io();

  const app = {
    sessionId: null,
    mode: "coach",
    canvas: null,
    ctx: null,
    players: {},
    ball: { x: 72, y: 50, visible: true, holder: null },
    layout: "lineout",
    attackDirection: "right-to-left",
    playerSize: "large",
    teamColor: "red",
    frozen: false,
    draggingPlayer: null,
    draggingBall: false
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    app.canvas = document.getElementById("fieldCanvas");
    app.ctx = app.canvas.getContext("2d");

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    bindUI();
    bindCanvas();
    bindSocket();

    const params = new URLSearchParams(window.location.search);
    const sessionFromUrl = params.get("session");

    if (sessionFromUrl) {
      app.sessionId = sessionFromUrl;
      socket.emit("coach:joinSession", { sessionId: app.sessionId });
    } else {
      socket.emit("coach:createSession");
    }

    requestAnimationFrame(draw);
  }

  function bindUI() {
    byId("coachModeBtn")?.addEventListener("click", () => setMode("coach"));
    byId("playerModeBtn")?.addEventListener("click", () => setMode("player"));

    byId("lineoutBtn")?.addEventListener("click", () => {
      socket.emit("coach:setLayout", { sessionId: app.sessionId, layout: "lineout" });
    });

    byId("scrumBtn")?.addEventListener("click", () => {
      socket.emit("coach:setLayout", { sessionId: app.sessionId, layout: "scrum" });
    });

    byId("resetBtn")?.addEventListener("click", () => {
      socket.emit("coach:reset", { sessionId: app.sessionId });
    });

    byId("freezeBtn")?.addEventListener("click", () => {
      app.frozen = !app.frozen;
      socket.emit("coach:freeze", { sessionId: app.sessionId, frozen: app.frozen });
    });

    byId("attackDirectionSelect")?.addEventListener("change", (e) => {
      socket.emit("coach:setAttackDirection", {
        sessionId: app.sessionId,
        attackDirection: e.target.value
      });
    });

    byId("playerSizeSelect")?.addEventListener("change", (e) => {
      socket.emit("coach:setPlayerSize", {
        sessionId: app.sessionId,
        playerSize: e.target.value
      });
    });

    byId("teamColorSelect")?.addEventListener("change", (e) => {
      socket.emit("coach:setTeamColor", {
        sessionId: app.sessionId,
        teamColor: e.target.value
      });
    });

    byId("copySessionBtn")?.addEventListener("click", copySessionLink);

    byId("joinSessionBtn")?.addEventListener("click", () => {
      const playerNumber = byId("playerNumberSelect")?.value;
      if (!playerNumber) return alert("Select your player number first.");

      const controllerId = getControllerId();

      socket.emit("player:joinSession", {
        sessionId: app.sessionId,
        playerNumber,
        controllerId
      });
    });
  }

  function bindSocket() {
    socket.on("coach:sessionCreated", applySession);
    socket.on("coach:sessionJoined", applySession);
    socket.on("session:update", applySession);
    socket.on("player:joined", (data) => applySession(data.session));

    socket.on("simulator:loadPlay", (play) => {
      if (window.PlaySimulator) window.PlaySimulator.loadPlay(play);
    });

    socket.on("simulator:start", () => {
      if (window.PlaySimulator) window.PlaySimulator.start();
    });

    socket.on("simulator:pause", () => {
      if (window.PlaySimulator) window.PlaySimulator.pause();
    });

    socket.on("simulator:resume", () => {
      if (window.PlaySimulator) window.PlaySimulator.resume();
    });

    socket.on("simulator:reset", () => {
      if (window.PlaySimulator) window.PlaySimulator.reset();
    });
  }

  function applySession(session) {
    if (!session) return;

    app.sessionId = session.id;
    app.players = session.players || {};
    app.ball = session.ball || app.ball;
    app.layout = session.layout || app.layout;
    app.attackDirection = session.attackDirection || app.attackDirection;
    app.playerSize = session.playerSize || app.playerSize;
    app.teamColor = session.teamColor || app.teamColor;
    app.frozen = !!session.frozen;

    window.players = app.players;

    updateSessionUI();
  }

  function updateSessionUI() {
    const code = byId("sessionCodeText");
    if (code) code.textContent = app.sessionId || "----";

    const freezeBtn = byId("freezeBtn");
    if (freezeBtn) freezeBtn.textContent = app.frozen ? "Unfreeze" : "Freeze";

    updateQR();
  }

  function updateQR() {
    const box = byId("qrCodeBox");
    if (!box || !app.sessionId) return;

    const url = getSessionUrl();

    box.innerHTML = `
      <img
        src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}"
        alt="Session QR Code"
      />
    `;
  }

  function getSessionUrl() {
    return `${window.location.origin}/clarity.html?session=${app.sessionId}`;
  }

  async function copySessionLink() {
    if (!app.sessionId) return;

    try {
      await navigator.clipboard.writeText(getSessionUrl());
      const btn = byId("copySessionBtn");
      if (btn) {
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy Link"), 1200);
      }
    } catch {
      alert(getSessionUrl());
    }
  }

  function setMode(mode) {
    app.mode = mode;

    byId("coachModeBtn")?.classList.toggle("active", mode === "coach");
    byId("playerModeBtn")?.classList.toggle("active", mode === "player");
    byId("playerJoinPanel")?.classList.toggle("hidden", mode !== "player");
  }

  function bindCanvas() {
    app.canvas.addEventListener("pointerdown", onPointerDown);
    app.canvas.addEventListener("pointermove", onPointerMove);
    app.canvas.addEventListener("pointerup", onPointerUp);
    app.canvas.addEventListener("pointerleave", onPointerUp);
  }

  function onPointerDown(e) {
    const point = eventToNorm(e);

    if (isNearBall(point)) {
      app.draggingBall = true;
      return;
    }

    const hit = getPlayerAt(point);
    if (hit) {
      app.draggingPlayer = hit.number;
    }
  }

  function onPointerMove(e) {
    if (!app.draggingPlayer && !app.draggingBall) return;

    const point = eventToNorm(e);

    if (app.draggingBall) {
      app.ball.x = point.x;
      app.ball.y = point.y;

      socket.emit("coach:moveBall", {
        sessionId: app.sessionId,
        x: point.x,
        y: point.y,
        holder: null
      });

      return;
    }

    if (app.draggingPlayer) {
      const player = app.players[String(app.draggingPlayer)];
      if (!player) return;

      player.x = point.x;
      player.y = point.y;

      socket.emit("coach:movePlayer", {
        sessionId: app.sessionId,
        playerNumber: app.draggingPlayer,
        x: point.x,
        y: point.y
      });
    }
  }

  function onPointerUp() {
    app.draggingPlayer = null;
    app.draggingBall = false;
  }

  function resizeCanvas() {
    const parent = app.canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    app.canvas.width = rect.width * window.devicePixelRatio;
    app.canvas.height = rect.height * window.devicePixelRatio;

    app.canvas.style.width = `${rect.width}px`;
    app.canvas.style.height = `${rect.height}px`;

    app.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function draw() {
    clear();
    drawRugbyField();
    drawPlayers();
    drawBall();

    requestAnimationFrame(draw);
  }

  function clear() {
    const w = cssWidth();
    const h = cssHeight();

    app.ctx.clearRect(0, 0, w, h);
  }

  function drawRugbyField() {
    const ctx = app.ctx;
    const w = cssWidth();
    const h = cssHeight();

    ctx.fillStyle = "#147a3d";
    ctx.fillRect(0, 0, w, h);

    drawGrassStripes();

    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 2;

    ctx.strokeRect(0, 0, w, h);

    const horizontalMarks = [
      { y: 100, label: "OUR TRYLINE" },
      { y: 88, label: "5M" },
      { y: 66, label: "22M" },
      { y: 36, label: "40M" },
      { y: 0, label: "50M" }
    ];

    horizontalMarks.forEach((m) => {
      const y = normToCanvas({ x: 0, y: m.y }).y;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "bold 13px Arial";
      ctx.fillText(m.label, 10, y + (m.y === 0 ? 18 : -8));
      ctx.fillText(m.label, w - 70, y + (m.y === 0 ? 18 : -8));
    });

    const widthMarks = [
      { x: 5, label: "5M" },
      { x: 15, label: "15M" },
      { x: 85, label: "15M" },
      { x: 95, label: "5M" }
    ];

    widthMarks.forEach((m) => {
      const x = normToCanvas({ x: m.x, y: 0 }).x;

      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.translate(x + 4, h - 20);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 12px Arial";
      ctx.fillText(m.label, 0, 0);
      ctx.restore();
    });

    drawHashMarks();
  }

  function drawGrassStripes() {
    const ctx = app.ctx;
    const w = cssWidth();
    const h = cssHeight();

    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.035)";
      ctx.fillRect(0, (h / 10) * i, w, h / 10);
    }
  }

  function drawHashMarks() {
    const ctx = app.ctx;

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;

    for (let y = 10; y <= 95; y += 10) {
      [5, 15, 85, 95].forEach((x) => {
        const p = normToCanvas({ x, y });
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y);
        ctx.lineTo(p.x + 5, p.y);
        ctx.stroke();
      });
    }
  }

  function drawPlayers() {
    Object.values(app.players).forEach(drawPlayer);
  }

  function drawPlayer(player) {
    const ctx = app.ctx;
    const p = normToCanvas(player);
    const radius = getPlayerRadius();

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = getColor(player.color || app.teamColor);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = player.connected ? "#ffffff" : "rgba(255,255,255,0.45)";
    ctx.stroke();

    ctx.fillStyle = player.color === "white" ? "#111" : "#fff";
    ctx.font = `bold ${Math.max(11, radius)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.number, p.x, p.y + 1);

    if (player.connected) {
      ctx.beginPath();
      ctx.arc(p.x + radius * 0.72, p.y - radius * 0.72, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#00ff88";
      ctx.fill();
    }
  }

  function drawBall() {
    if (!app.ball || !app.ball.visible) return;

    const ctx = app.ctx;
    const p = normToCanvas(app.ball);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.35);

    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f4c16e";
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#4a2b12";
    ctx.stroke();

    ctx.restore();
  }

  function getPlayerAt(point) {
    const radiusNorm = 4;

    return Object.values(app.players).find((p) => {
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      return d <= radiusNorm;
    });
  }

  function isNearBall(point) {
    if (!app.ball) return false;
    return Math.hypot(app.ball.x - point.x, app.ball.y - point.y) <= 4;
  }

  function eventToNorm(e) {
    const rect = app.canvas.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    return {
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100)
    };
  }

  function normToCanvas(point) {
    return {
      x: (point.x / 100) * cssWidth(),
      y: (point.y / 100) * cssHeight()
    };
  }

  function cssWidth() {
    return app.canvas.clientWidth;
  }

  function cssHeight() {
    return app.canvas.clientHeight;
  }

  function getPlayerRadius() {
    if (app.playerSize === "small") return 12;
    if (app.playerSize === "medium") return 17;
    return 25;
  }

  function getColor(color) {
    const map = {
      red: "#d8222a",
      black: "#111111",
      white: "#f5f5f5",
      blue: "#1d5fd1",
      green: "#118b4f"
    };

    return map[color] || map.red;
  }

  function getControllerId() {
    let id = localStorage.getItem("teamClarityControllerId");

    if (!id) {
      id = "controller_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("teamClarityControllerId", id);
    }

    return id;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  window.TeamClarityCoach = app;
})();
