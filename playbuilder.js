const field = document.getElementById("playField");
const stepCount = document.getElementById("stepCount");
const movementLayer = document.getElementById("movementLayer");

let players = [];
let ball = null;
let steps = [];

function createPlayer(number, xPercent, yPercent) {
  const el = document.createElement("div");
  el.className = "player";
  el.dataset.number = number;

  el.innerHTML = `
    <div class="player-head"></div>
    <div class="player-body">
      <span class="player-number">${number}</span>
    </div>
    <div class="player-legs">
      <span></span>
      <span></span>
    </div>
  `;

  setPositionPercent(el, xPercent, yPercent);
  makeDraggable(el);
  field.appendChild(el);
  players.push(el);
}

function createBall(xPercent, yPercent) {
  ball = document.createElement("div");
  ball.className = "ball";
  setPositionPercent(ball, xPercent, yPercent);
  makeDraggable(ball);
  field.appendChild(ball);
}

function setPositionPercent(el, xPercent, yPercent) {
  el.style.left = xPercent + "%";
  el.style.top = yPercent + "%";
}

function getPositionPercent(el) {
  return {
    x: parseFloat(el.style.left),
    y: parseFloat(el.style.top)
  };
}

function makeDraggable(el) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function start(clientX, clientY) {
    dragging = true;
    el.style.transition = "none";

    const rect = el.getBoundingClientRect();
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
  }

  function move(clientX, clientY) {
    if (!dragging) return;

    const fieldRect = field.getBoundingClientRect();

    let x = ((clientX - fieldRect.left - offsetX) / fieldRect.width) * 100;
    let y = ((clientY - fieldRect.top - offsetY) / fieldRect.height) * 100;

    x = Math.max(0, Math.min(97, x));
    y = Math.max(0, Math.min(92, y));

    el.style.left = x + "%";
    el.style.top = y + "%";
  }

  function stop() {
    dragging = false;
  }

  el.addEventListener("mousedown", e => {
    e.preventDefault();
    start(e.clientX, e.clientY);
  });

  window.addEventListener("mousemove", e => move(e.clientX, e.clientY));
  window.addEventListener("mouseup", stop);

  el.addEventListener("touchstart", e => {
    const t = e.touches[0];
    start(t.clientX, t.clientY);
  }, { passive: false });

  window.addEventListener("touchmove", e => {
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  }, { passive: false });

  window.addEventListener("touchend", stop);
}

function captureStep() {
  return {
    players: players.map(p => ({
      number: p.dataset.number,
      ...getPositionPercent(p)
    })),
    ball: getPositionPercent(ball)
  };
}

function applyStep(step, transition = false) {
  players.forEach(p => {
    const saved = step.players.find(s => s.number === p.dataset.number);
    if (!saved) return;

    p.style.transition = transition ? "left 0.85s linear, top 0.85s linear" : "none";
    setPositionPercent(p, saved.x, saved.y);
  });

  ball.style.transition = transition ? "left 0.85s linear, top 0.85s linear" : "none";
  setPositionPercent(ball, step.ball.x, step.ball.y);
}

function addStep() {
  steps.push(captureStep());
  updateStepCounter();
  drawMovementLines();
}

function resetToStep(index) {
  if (!steps[index]) return;
  applyStep(steps[index], false);
  drawMovementLines();
}

function playAnimation() {
  if (steps.length < 2) {
    alert("Add at least 2 steps first");
    return;
  }

  clearMovementLines();
  applyStep(steps[0], false);

  let i = 1;

  const interval = setInterval(() => {
    applyStep(steps[i], true);
    i++;

    if (i >= steps.length) {
      clearInterval(interval);
      setTimeout(drawMovementLines, 900);
    }
  }, 950);
}

function savePlay() {
  const play = {
    name: document.getElementById("playName").value || "Unnamed Play",
    type: document.getElementById("playType").value,
    steps
  };

  localStorage.setItem("teamClarityPlayBuilderSave", JSON.stringify(play));
  alert("Play saved: " + play.name);
}

function loadPlay() {
  const saved = localStorage.getItem("teamClarityPlayBuilderSave");

  if (!saved) {
    alert("No saved play found");
    return;
  }

  const play = JSON.parse(saved);

  document.getElementById("playName").value = play.name;
  document.getElementById("playType").value = play.type;

  steps = play.steps || [];
  updateStepCounter();

  if (steps.length > 0) {
    applyStep(steps[0], false);
  }

  drawMovementLines();
}

function updateStepCounter() {
  stepCount.innerText = steps.length;
}

function clearMovementLines() {
  movementLayer.innerHTML = "";
}

function drawMovementLines() {
  clearMovementLines();

  if (steps.length < 2) return;

  const fieldRect = field.getBoundingClientRect();
  movementLayer.setAttribute("width", fieldRect.width);
  movementLayer.setAttribute("height", fieldRect.height);

  const latest = steps[steps.length - 1];
  const previous = steps[steps.length - 2];

  latest.players.forEach(current => {
    const before = previous.players.find(p => p.number === current.number);
    if (!before) return;

    drawArrow(
      percentToPx(before.x, fieldRect.width) + 20,
      percentToPx(before.y, fieldRect.height) + 25,
      percentToPx(current.x, fieldRect.width) + 20,
      percentToPx(current.y, fieldRect.height) + 25,
      "white"
    );
  });

  drawArrow(
    percentToPx(previous.ball.x, fieldRect.width) + 10,
    percentToPx(previous.ball.y, fieldRect.height) + 10,
    percentToPx(latest.ball.x, fieldRect.width) + 10,
    percentToPx(latest.ball.y, fieldRect.height) + 10,
    "#ffd84a"
  );
}

function percentToPx(percent, size) {
  return (percent / 100) * size;
}

function drawArrow(x1, y1, x2, y2, color) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  if (distance < 8) return;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "4");
  line.setAttribute("stroke-dasharray", "8 6");
  line.setAttribute("opacity", "0.85");
  movementLayer.appendChild(line);
}

function setStartingShape() {
  const type = document.getElementById("playType").value;

  steps = [];
  clearPlayersAndBall();

  if (type === "Lineout") {
    createLineoutShape();
  } else if (type === "Scrum") {
    createScrumShape();
  } else {
    createGeneralPlayShape();
  }

  createBall(55, 42);
  addStep();
}

function clearPlayersAndBall() {
  players.forEach(p => p.remove());
  players = [];

  if (ball) ball.remove();
  ball = null;
}

function createLineoutShape() {
  const baseX = 43;

  [1, 3, 4, 5, 6, 7, 8].forEach((num, i) => {
    createPlayer(num, baseX, 19 + i * 5);
  });

  createPlayer(2, baseX - 7, 15);
  createPlayer(9, 51, 43);
  createPlayer(10, 58, 39);
  createPlayer(12, 67, 47);
  createPlayer(13, 77, 56);
  createPlayer(11, 55, 25);
  createPlayer(14, 94, 80);
  createPlayer(15, 86, 65);
}

function createScrumShape() {
  createPlayer(1, 43, 38);
  createPlayer(2, 46, 38);
  createPlayer(3, 49, 38);
  createPlayer(4, 44.5, 43);
  createPlayer(5, 47.5, 43);
  createPlayer(6, 42, 47);
  createPlayer(7, 50, 47);
  createPlayer(8, 46, 52);

  createPlayer(9, 55, 48);
  createPlayer(10, 62, 43);
  createPlayer(12, 70, 48);
  createPlayer(13, 78, 55);
  createPlayer(11, 63, 30);
  createPlayer(14, 91, 70);
  createPlayer(15, 82, 62);
}

function createGeneralPlayShape() {
  createPlayer(1, 24, 28);
  createPlayer(2, 72, 18);
  createPlayer(3, 52, 28);
  createPlayer(4, 56, 42);
  createPlayer(5, 24, 60);
  createPlayer(6, 40, 23);
  createPlayer(7, 48, 37);
  createPlayer(8, 74, 44);
  createPlayer(9, 85, 34);
  createPlayer(10, 32, 75);
  createPlayer(11, 38, 47);
  createPlayer(12, 64, 54);
  createPlayer(13, 56, 72);
  createPlayer(14, 67, 76);
  createPlayer(15, 46, 65);
}

function init() {
  createLineoutShape();
  createBall(55, 42);
  addStep();
}

init();
