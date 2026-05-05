const socket = io();

const params = new URLSearchParams(window.location.search);
const playerNumber = Number(params.get("p"));

const statusEl = document.getElementById("status");
const playerNumberEl = document.getElementById("playerNumber");
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");

playerNumberEl.textContent = playerNumber || "?";

if (!playerNumber || playerNumber < 1 || playerNumber > 15) {
  statusEl.textContent = "Invalid player QR code";
} else {
  statusEl.textContent = `Player ${playerNumber} connected`;
  socket.emit("join-player", playerNumber);
}

let active = false;

function centerStick() {
  stick.style.left = "50%";
  stick.style.top = "50%";
  stick.style.transform = "translate(-50%, -50%)";
}

function sendMove(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  let dx = clientX - cx;
  let dy = clientY - cy;

  const max = rect.width / 2 - 48;
  const dist = Math.hypot(dx, dy);

  if (dist > max) {
    dx = (dx / dist) * max;
    dy = (dy / dist) * max;
  }

  stick.style.left = `${rect.width / 2 + dx}px`;
  stick.style.top = `${rect.height / 2 + dy}px`;
  stick.style.transform = "translate(-50%, -50%)";

  socket.emit("move", {
    x: dx / max,
    y: dy / max
  });
}

function stopMove() {
  active = false;
  centerStick();
  socket.emit("move", { x: 0, y: 0 });
}

joystick.addEventListener("pointerdown", e => {
  active = true;
  joystick.setPointerCapture(e.pointerId);
  sendMove(e.clientX, e.clientY);
});

joystick.addEventListener("pointermove", e => {
  if (!active) return;
  sendMove(e.clientX, e.clientY);
});

joystick.addEventListener("pointerup", stopMove);
joystick.addEventListener("pointercancel", stopMove);
joystick.addEventListener("pointerleave", stopMove);

window.addEventListener("beforeunload", () => {
  socket.emit("move", { x: 0, y: 0 });
});
