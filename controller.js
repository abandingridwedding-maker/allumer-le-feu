const socket = io();
const params = new URLSearchParams(location.search);
const playerNumber = Number(params.get("p") || 1);
document.getElementById("playerNumber").textContent = playerNumber;
document.getElementById("status").textContent = "Player " + playerNumber + " connected";

socket.emit("join-player", playerNumber);

const joy = document.getElementById("joy");
const knob = document.getElementById("knob");

let active = false;
let center = {x:0,y:0};
let current = {x:0,y:0};

function setKnob(dx,dy){
  const max = 86;
  const len = Math.hypot(dx,dy);
  if(len > max){
    dx = dx / len * max;
    dy = dy / len * max;
  }
  knob.style.left = (95 + dx) + "px";
  knob.style.top = (95 + dy) + "px";
  current.x = dx / max;
  current.y = dy / max;
  socket.emit("move", current);
}

function start(e){
  e.preventDefault();
  active = true;
  const rect = joy.getBoundingClientRect();
  center.x = rect.left + rect.width/2;
  center.y = rect.top + rect.height/2;
  move(e);
}

function move(e){
  if(!active) return;
  e.preventDefault();
  const t = e.touches ? e.touches[0] : e;
  setKnob(t.clientX - center.x, t.clientY - center.y);
}

function end(e){
  e.preventDefault();
  active = false;
  setKnob(0,0);
}

joy.addEventListener("touchstart", start, {passive:false});
joy.addEventListener("touchmove", move, {passive:false});
joy.addEventListener("touchend", end, {passive:false});
joy.addEventListener("touchcancel", end, {passive:false});
joy.addEventListener("mousedown", start);
window.addEventListener("mousemove", move);
window.addEventListener("mouseup", end);

setInterval(()=>socket.emit("move", current), 80);