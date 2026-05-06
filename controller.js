const socket = io();

const params = new URLSearchParams(window.location.search);
const playerNumber = Number(params.get("p") || 1);

const statusEl = document.getElementById("status");
const playerNumberEl = document.getElementById("playerNumber");
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");

playerNumberEl.textContent = playerNumber;

let active = false;
let moveInterval = null;
let currentMove = { dx: 0, dy: 0 };

socket.emit("controller-connect", playerNumber);

statusEl.textContent = "Connected ✅";

function resetStick() {
  stick.style.left = "50%";
  stick.style.top = "50%";
  currentMove = { dx: 0, dy: 0 };
}

function getJoystickCenter() {
  const rect = joystick.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function updateStick(clientX, clientY) {
  const center = getJoystickCenter();

  let dx = clientX - center.x;
  let dy = clientY - center.y;

  const max = 82;
  const dist = Math.hypot(dx, dy);

  if (dist > max) {
    dx = (dx / dist) * max;
    dy = (dy / dist) * max;
  }

  stick.style.left = `calc(50% + ${dx}px)`;
  stick.style.top = `calc(50% + ${dy}px)`;

  currentMove = {
    dx: dx / max,
    dy: dy / max
  };
}

function startMoving() {
  if (moveInterval) return;

  moveInterval = setInterval(() => {
    socket.emit("controller-move", {
      dx: currentMove.dx,
      dy: currentMove.dy
    });
  }, 40);
}

function stopMoving() {
  clearInterval(moveInterval);
  moveInterval = null;

  resetStick();

  socket.emit("controller-move", {
    dx: 0,
    dy: 0
  });
}

joystick.addEventListener("touchstart", e => {
  e.preventDefault();

  active = true;

  const t = e.touches[0];

  updateStick(t.clientX, t.clientY);
  startMoving();
}, { passive: false });

joystick.addEventListener("touchmove", e => {
  e.preventDefault();

  if (!active) return;

  const t = e.touches[0];

  updateStick(t.clientX, t.clientY);
}, { passive: false });

joystick.addEventListener("touchend", e => {
  e.preventDefault();

  active = false;
  stopMoving();
}, { passive: false });

joystick.addEventListener("mousedown", e => {
  active = true;

  updateStick(e.clientX, e.clientY);
  startMoving();
});

window.addEventListener("mousemove", e => {
  if (!active) return;

  updateStick(e.clientX, e.clientY);
});

window.addEventListener("mouseup", () => {
  if (!active) return;

  active = false;
  stopMoving();
});

socket.on("connect", () => {
  socket.emit("controller-connect", playerNumber);
  statusEl.textContent = "Connected ✅";
});

socket.on("disconnect", () => {
  statusEl.textContent = "Disconnected";
});

window.addEventListener("beforeunload", () => {
  stopMoving();
});
