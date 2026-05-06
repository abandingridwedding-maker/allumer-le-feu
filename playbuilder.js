const field = document.getElementById("field");
const stepCount = document.getElementById("stepCount");

let players = [];
let ball;
let steps = [];

function createPlayer(number, x, y) {
  const el = document.createElement("div");
  el.className = "player";
  el.innerText = number;
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.dataset.number = number;

  makeDraggable(el);
  field.appendChild(el);
  players.push(el);
}

function createBall(x, y) {
  ball = document.createElement("div");
  ball.className = "ball";
  ball.style.left = x + "px";
  ball.style.top = y + "px";

  makeDraggable(ball);
  field.appendChild(ball);
}

function makeDraggable(el) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;

  el.addEventListener("mousedown", e => {
    dragging = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
  });

  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    el.style.left = e.clientX - offsetX + "px";
    el.style.top = e.clientY - offsetY + "px";
  });

  window.addEventListener("mouseup", () => dragging = false);

  el.addEventListener("touchstart", e => {
    dragging = true;
    const t = e.touches[0];
    offsetX = t.clientX - el.offsetLeft;
    offsetY = t.clientY - el.offsetTop;
  });

  window.addEventListener("touchmove", e => {
    if (!dragging) return;
    const t = e.touches[0];
    el.style.left = t.clientX - offsetX + "px";
    el.style.top = t.clientY - offsetY + "px";
  });

  window.addEventListener("touchend", () => dragging = false);
}

function captureStep() {
  return {
    players: players.map(p => ({
      number: p.dataset.number,
      x: parseInt(p.style.left),
      y: parseInt(p.style.top)
    })),
    ball: {
      x: parseInt(ball.style.left),
      y: parseInt(ball.style.top)
    }
  };
}

function addStep() {
  steps.push(captureStep());
  stepCount.innerText = steps.length;
  alert("Step " + steps.length + " saved");
}

function resetToStep(index) {
  if (!steps[index]) return;

  const step = steps[index];

  step.players.forEach(saved => {
    const p = players.find(pl => pl.dataset.number === saved.number);
    if (p) {
      p.style.left = saved.x + "px";
      p.style.top = saved.y + "px";
    }
  });

  ball.style.left = step.ball.x + "px";
  ball.style.top = step.ball.y + "px";
}

function animateToStep(step) {
  step.players.forEach(saved => {
    const p = players.find(pl => pl.dataset.number === saved.number);
    if (p) {
      p.style.transition = "all 0.8s linear";
      p.style.left = saved.x + "px";
      p.style.top = saved.y + "px";
    }
  });

  ball.style.transition = "all 0.8s linear";
  ball.style.left = step.ball.x + "px";
  ball.style.top = step.ball.y + "px";
}

function playAnimation() {
  if (steps.length < 2) {
    alert("Add at least 2 steps first");
    return;
  }

  resetToStep(0);

  let i = 1;

  const interval = setInterval(() => {
    animateToStep(steps[i]);
    i++;

    if (i >= steps.length) {
      clearInterval(interval);
    }
  }, 1000);
}

function savePlay() {
  const play = {
    name: document.getElementById("playName").value || "Unnamed Play",
    type: document.getElementById("playType").value,
    steps
  };

  localStorage.setItem("teamClaritySavedPlay", JSON.stringify(play));
  alert("Play saved");
}

function loadPlay() {
  const saved = localStorage.getItem("teamClaritySavedPlay");

  if (!saved) {
    alert("No saved play found");
    return;
  }

  const play = JSON.parse(saved);

  document.getElementById("playName").value = play.name;
  document.getElementById("playType").value = play.type;
  steps = play.steps;

  stepCount.innerText = steps.length;
  resetToStep(0);

  alert("Loaded: " + play.name);
}

function init() {
  const startX = window.innerWidth / 2 - 200;
  const startY = 120;

  for (let i = 1; i <= 15; i++) {
    createPlayer(i, startX + (i % 5) * 70, startY + Math.floor(i / 5) * 70);
  }

  createBall(startX + 400, startY + 100);
  addStep();
}

init();
