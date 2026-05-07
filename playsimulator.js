/* TEAM-CLARITY V2 - playsimulator.js
   Full play simulator engine
   Normalized field coordinates: x 0-100, y 0-100
*/

(function () {
  "use strict";

  const PlaySimulator = {
    state: {
      isActive: false,
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: 8000,
      speed: 1,
      animationFrame: null,
      lastFrameTime: null,

      selectedPlayId: null,
      selectedRole: null,

      players: {},
      ball: {
        x: 50,
        y: 50,
        targetX: 50,
        targetY: 50,
        holder: null,
        visible: true
      },

      play: {
        id: null,
        name: "Untitled Play",
        type: "general",
        direction: "right-to-left",
        keyframes: [],
        ballKeyframes: []
      },

      scoring: {
        enabled: true,
        playerRole: null,
        score: 0,
        positionScore: 0,
        timingScore: 0,
        maxScore: 10,
        tolerance: 6,
        timingTolerance: 600,
        feedback: ""
      }
    },

    init(options = {}) {
      this.canvas = options.canvas || document.getElementById("fieldCanvas") || document.querySelector("canvas");
      this.ctx = this.canvas ? this.canvas.getContext("2d") : null;

      this.socket = options.socket || window.socket || null;
      this.getCoachPlayers = options.getCoachPlayers || (() => window.players || {});
      this.onStateUpdate = options.onStateUpdate || null;

      this.bindSocketEvents();
      this.bindUI();

      window.PlaySimulator = this;
      console.log("TEAM-CLARITY V2 PlaySimulator loaded");
    },

    bindSocketEvents() {
      if (!this.socket) return;

      this.socket.on("simulator:loadPlay", (play) => {
        this.loadPlay(play);
      });

      this.socket.on("simulator:start", () => {
        this.start();
      });

      this.socket.on("simulator:pause", () => {
        this.pause();
      });

      this.socket.on("simulator:resume", () => {
        this.resume();
      });

      this.socket.on("simulator:reset", () => {
        this.reset();
      });

      this.socket.on("simulator:setRole", (role) => {
        this.setPlayerRole(role);
      });
    },

    bindUI() {
      const startBtn = document.getElementById("simStartBtn");
      const pauseBtn = document.getElementById("simPauseBtn");
      const resetBtn = document.getElementById("simResetBtn");
      const speedSelect = document.getElementById("simSpeedSelect");
      const roleSelect = document.getElementById("simRoleSelect");

      if (startBtn) startBtn.addEventListener("click", () => this.start());
      if (pauseBtn) pauseBtn.addEventListener("click", () => this.togglePause());
      if (resetBtn) resetBtn.addEventListener("click", () => this.reset());

      if (speedSelect) {
        speedSelect.addEventListener("change", (e) => {
          this.setSpeed(Number(e.target.value));
        });
      }

      if (roleSelect) {
        roleSelect.addEventListener("change", (e) => {
          this.setPlayerRole(e.target.value);
        });
      }
    },

    createEmptyPlay(name = "Untitled Play", type = "general") {
      return {
        id: cryptoRandomId(),
        name,
        type,
        direction: "right-to-left",
        keyframes: [],
        ballKeyframes: []
      };
    },

    loadPlay(play) {
      if (!play) return;

      this.state.play = {
        id: play.id || cryptoRandomId(),
        name: play.name || "Untitled Play",
        type: play.type || "general",
        direction: play.direction || "right-to-left",
        keyframes: Array.isArray(play.keyframes) ? play.keyframes : [],
        ballKeyframes: Array.isArray(play.ballKeyframes) ? play.ballKeyframes : []
      };

      this.state.duration = this.calculateDuration(this.state.play);
      this.state.currentTime = 0;
      this.state.selectedPlayId = this.state.play.id;
      this.state.isActive = true;

      this.applyFrame(0);
      this.emitState();

      console.log("Play loaded:", this.state.play.name);
    },

    saveCurrentPlay() {
      return JSON.parse(JSON.stringify(this.state.play));
    },

    addKeyframe(time, playerPositions = null) {
      const players = playerPositions || this.snapshotCurrentPlayers();

      this.state.play.keyframes.push({
        time,
        players
      });

      this.state.play.keyframes.sort((a, b) => a.time - b.time);
      this.state.duration = this.calculateDuration(this.state.play);

      this.emitState();
    },

    addBallKeyframe(time, ballData = null) {
      const ball = ballData || {
        x: this.state.ball.x,
        y: this.state.ball.y,
        holder: this.state.ball.holder || null
      };

      this.state.play.ballKeyframes.push({
        time,
        ...ball
      });

      this.state.play.ballKeyframes.sort((a, b) => a.time - b.time);
      this.state.duration = this.calculateDuration(this.state.play);

      this.emitState();
    },

    snapshotCurrentPlayers() {
      const sourcePlayers = this.getCoachPlayers();
      const snapshot = {};

      Object.keys(sourcePlayers).forEach((id) => {
        const p = sourcePlayers[id];
        snapshot[id] = {
          id,
          number: p.number || id,
          role: p.role || String(p.number || id),
          x: clamp(p.x ?? 50, 0, 100),
          y: clamp(p.y ?? 50, 0, 100)
        };
      });

      return snapshot;
    },

    start() {
      if (!this.state.play.keyframes.length) {
        this.buildDefaultDemoPlay();
      }

      this.state.isActive = true;
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.state.currentTime = 0;
      this.state.lastFrameTime = null;

      this.loop();

      this.emitSocket("simulator:start", {
        playId: this.state.play.id
      });
    },

    pause() {
      this.state.isPaused = true;
      this.state.isPlaying = false;

      if (this.state.animationFrame) {
        cancelAnimationFrame(this.state.animationFrame);
        this.state.animationFrame = null;
      }

      this.emitSocket("simulator:pause", {});
    },

    resume() {
      if (!this.state.isActive) return;

      this.state.isPaused = false;
      this.state.isPlaying = true;
      this.state.lastFrameTime = null;

      this.loop();

      this.emitSocket("simulator:resume", {});
    },

    togglePause() {
      if (this.state.isPlaying) this.pause();
      else this.resume();
    },

    reset() {
      this.state.currentTime = 0;
      this.state.isPlaying = false;
      this.state.isPaused = false;
      this.state.lastFrameTime = null;

      if (this.state.animationFrame) {
        cancelAnimationFrame(this.state.animationFrame);
        this.state.animationFrame = null;
      }

      this.applyFrame(0);
      this.resetScore();
      this.emitState();

      this.emitSocket("simulator:reset", {});
    },

    loop(timestamp) {
      if (!this.state.isPlaying || this.state.isPaused) return;

      if (!this.state.lastFrameTime) {
        this.state.lastFrameTime = timestamp || performance.now();
      }

      const now = timestamp || performance.now();
      const delta = (now - this.state.lastFrameTime) * this.state.speed;

      this.state.lastFrameTime = now;
      this.state.currentTime += delta;

      if (this.state.currentTime >= this.state.duration) {
        this.state.currentTime = this.state.duration;
        this.applyFrame(this.state.currentTime);
        this.finish();
        return;
      }

      this.applyFrame(this.state.currentTime);
      this.state.animationFrame = requestAnimationFrame((t) => this.loop(t));
    },

    finish() {
      this.state.isPlaying = false;
      this.state.isPaused = false;

      if (this.state.scoring.enabled) {
        this.calculateScore();
      }

      this.emitState();

      this.emitSocket("simulator:finish", {
        score: this.state.scoring.score,
        positionScore: this.state.scoring.positionScore,
        timingScore: this.state.scoring.timingScore
      });
    },

    applyFrame(time) {
      const interpolatedPlayers = this.interpolatePlayers(time);
      const interpolatedBall = this.interpolateBall(time);

      this.state.players = interpolatedPlayers;
      this.state.ball = {
        ...this.state.ball,
        ...interpolatedBall
      };

      if (typeof this.onStateUpdate === "function") {
        this.onStateUpdate(this.getPublicState());
      }

      this.renderOverlay();
    },

    interpolatePlayers(time) {
      const keyframes = this.state.play.keyframes;
      if (!keyframes.length) return {};

      if (time <= keyframes[0].time) return clone(keyframes[0].players);

      const last = keyframes[keyframes.length - 1];
      if (time >= last.time) return clone(last.players);

      let from = keyframes[0];
      let to = keyframes[1];

      for (let i = 0; i < keyframes.length - 1; i++) {
        if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
          from = keyframes[i];
          to = keyframes[i + 1];
          break;
        }
      }

      const progress = smoothstep((time - from.time) / Math.max(1, to.time - from.time));
      const result = {};
      const ids = new Set([...Object.keys(from.players), ...Object.keys(to.players)]);

      ids.forEach((id) => {
        const a = from.players[id] || to.players[id];
        const b = to.players[id] || from.players[id];

        result[id] = {
          ...b,
          id,
          x: lerp(a.x, b.x, progress),
          y: lerp(a.y, b.y, progress)
        };
      });

      return result;
    },

    interpolateBall(time) {
      const keyframes = this.state.play.ballKeyframes;
      if (!keyframes.length) return this.state.ball;

      if (time <= keyframes[0].time) return clone(keyframes[0]);

      const last = keyframes[keyframes.length - 1];
      if (time >= last.time) return clone(last);

      let from = keyframes[0];
      let to = keyframes[1];

      for (let i = 0; i < keyframes.length - 1; i++) {
        if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
          from = keyframes[i];
          to = keyframes[i + 1];
          break;
        }
      }

      const progress = smoothstep((time - from.time) / Math.max(1, to.time - from.time));

      return {
        x: lerp(from.x, to.x, progress),
        y: lerp(from.y, to.y, progress),
        holder: progress < 0.5 ? from.holder : to.holder,
        visible: true
      };
    },

    calculateScore() {
      const role = this.state.scoring.playerRole || this.state.selectedRole;
      if (!role) {
        this.state.scoring.feedback = "No player role selected.";
        return;
      }

      const finalFrame = this.state.play.keyframes[this.state.play.keyframes.length - 1];
      const actualPlayer = this.findPlayerByRole(role, this.state.players);
      const targetPlayer = this.findPlayerByRole(role, finalFrame.players);

      if (!actualPlayer || !targetPlayer) {
        this.state.scoring.feedback = "Could not find player role in play.";
        return;
      }

      const distance = getDistance(actualPlayer.x, actualPlayer.y, targetPlayer.x, targetPlayer.y);
      const positionScore = Math.max(0, 5 - (distance / this.state.scoring.tolerance) * 5);

      const timingError = Math.abs(this.state.currentTime - this.state.duration);
      const timingScore = Math.max(0, 5 - (timingError / this.state.scoring.timingTolerance) * 5);

      const total = Math.round((positionScore + timingScore) * 10) / 10;

      this.state.scoring.positionScore = round1(positionScore);
      this.state.scoring.timingScore = round1(timingScore);
      this.state.scoring.score = round1(total);

      if (total >= 8) this.state.scoring.feedback = "Excellent timing and positioning.";
      else if (total >= 6) this.state.scoring.feedback = "Good, but improve timing or final position.";
      else if (total >= 4) this.state.scoring.feedback = "Shape is close, but detail needs work.";
      else this.state.scoring.feedback = "Recheck role, timing and final position.";
    },

    resetScore() {
      this.state.scoring.score = 0;
      this.state.scoring.positionScore = 0;
      this.state.scoring.timingScore = 0;
      this.state.scoring.feedback = "";
    },

    setPlayerRole(role) {
      this.state.selectedRole = role;
      this.state.scoring.playerRole = role;

      this.emitSocket("simulator:setRole", { role });
      this.emitState();
    },

    setSpeed(speed) {
      this.state.speed = clamp(speed || 1, 0.25, 3);
      this.emitState();
    },

    findPlayerByRole(role, players) {
      return Object.values(players || {}).find((p) => {
        return String(p.role) === String(role) || String(p.number) === String(role) || String(p.id) === String(role);
      });
    },

    calculateDuration(play) {
      const playerMax = Math.max(0, ...play.keyframes.map((k) => k.time || 0));
      const ballMax = Math.max(0, ...play.ballKeyframes.map((k) => k.time || 0));
      return Math.max(playerMax, ballMax, 1000);
    },

    getPublicState() {
      return {
        isActive: this.state.isActive,
        isPlaying: this.state.isPlaying,
        isPaused: this.state.isPaused,
        currentTime: this.state.currentTime,
        duration: this.state.duration,
        speed: this.state.speed,
        players: this.state.players,
        ball: this.state.ball,
        play: this.state.play,
        scoring: this.state.scoring
      };
    },

    emitState() {
      if (typeof this.onStateUpdate === "function") {
        this.onStateUpdate(this.getPublicState());
      }
    },

    emitSocket(event, payload) {
      if (!this.socket) return;
      this.socket.emit(event, payload);
    },

    renderOverlay() {
      const panel = document.getElementById("simulatorPanel");
      if (!panel) return;

      const progress = this.state.duration
        ? Math.round((this.state.currentTime / this.state.duration) * 100)
        : 0;

      const scoreText = this.state.scoring.feedback
        ? `${this.state.scoring.score}/10 - ${this.state.scoring.feedback}`
        : "No score yet";

      panel.innerHTML = `
        <div class="simulator-card">
          <div class="simulator-title">${escapeHtml(this.state.play.name || "Play Simulator")}</div>
          <div class="simulator-progress">
            <div class="simulator-progress-bar" style="width:${progress}%"></div>
          </div>
          <div class="simulator-meta">
            <span>${progress}%</span>
            <span>Speed: ${this.state.speed}x</span>
          </div>
          <div class="simulator-score">${scoreText}</div>
        </div>
      `;
    },

    buildDefaultDemoPlay() {
      const play = this.createEmptyPlay("Demo Lineout Strike", "lineout");

      play.keyframes = [
        {
          time: 0,
          players: {
            "9": { id: "9", number: 9, role: "9", x: 72, y: 48 },
            "10": { id: "10", number: 10, role: "10", x: 65, y: 54 },
            "12": { id: "12", number: 12, role: "12", x: 58, y: 59 },
            "13": { id: "13", number: 13, role: "13", x: 51, y: 64 },
            "11": { id: "11", number: 11, role: "11", x: 45, y: 70 },
            "14": { id: "14", number: 14, role: "14", x: 38, y: 76 },
            "15": { id: "15", number: 15, role: "15", x: 47, y: 42 }
          }
        },
        {
          time: 2500,
          players: {
            "9": { id: "9", number: 9, role: "9", x: 67, y: 48 },
            "10": { id: "10", number: 10, role: "10", x: 59, y: 53 },
            "12": { id: "12", number: 12, role: "12", x: 52, y: 58 },
            "13": { id: "13", number: 13, role: "13", x: 45, y: 63 },
            "11": { id: "11", number: 11, role: "11", x: 39, y: 69 },
            "14": { id: "14", number: 14, role: "14", x: 31, y: 75 },
            "15": { id: "15", number: 15, role: "15", x: 42, y: 44 }
          }
        },
        {
          time: 5000,
          players: {
            "9": { id: "9", number: 9, role: "9", x: 62, y: 48 },
            "10": { id: "10", number: 10, role: "10", x: 52, y: 52 },
            "12": { id: "12", number: 12, role: "12", x: 44, y: 57 },
            "13": { id: "13", number: 13, role: "13", x: 36, y: 62 },
            "11": { id: "11", number: 11, role: "11", x: 28, y: 68 },
            "14": { id: "14", number: 14, role: "14", x: 22, y: 74 },
            "15": { id: "15", number: 15, role: "15", x: 34, y: 46 }
          }
        }
      ];

      play.ballKeyframes = [
        { time: 0, x: 72, y: 48, holder: "9" },
        { time: 1200, x: 65, y: 54, holder: "10" },
        { time: 2600, x: 52, y: 58, holder: "12" },
        { time: 3900, x: 36, y: 62, holder: "13" },
        { time: 5000, x: 22, y: 74, holder: "14" }
      ];

      this.loadPlay(play);
    }
  };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getDistance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function cryptoRandomId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    return "play_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  document.addEventListener("DOMContentLoaded", () => {
    PlaySimulator.init({
      socket: window.socket || null,
      getCoachPlayers: () => window.players || {}
    });
  });

  window.PlaySimulator = PlaySimulator;
})();
